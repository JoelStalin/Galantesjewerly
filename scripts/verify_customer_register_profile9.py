from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

CURRENT_DIR = Path(__file__).resolve().parent.parent
E2E_DIR = CURRENT_DIR / 'tests' / 'e2e'
if str(E2E_DIR) not in sys.path:
    sys.path.insert(0, str(E2E_DIR))

from profile_runtime import get_driver as get_profile_runtime_driver

BASE_URL = os.getenv('E2E_BASE_URL', 'https://galantesjewelry.com').rstrip('/')
PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Profile 9')
HEADLESS = os.getenv('SELENIUM_HEADLESS', '0') == '1'

OUTPUT_DIR = CURRENT_DIR / 'tests' / 'e2e' / 'artifacts' / f"customer-register-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def save_screenshot(driver, name: str) -> str:
    filename = f'{name}.png'
    driver.save_screenshot(str(OUTPUT_DIR / filename))
    return filename


def visible_input_for_label(driver, label_text: str):
    xpath = (
        "//label[normalize-space()='%s']/following-sibling::input"
        % label_text
    )
    candidates = driver.find_elements(By.XPATH, xpath)
    visible = [element for element in candidates if element.is_displayed()]
    if not visible:
        raise AssertionError(f'Visible input not found for label: {label_text}')
    return visible[0]


def set_input(driver, wait: WebDriverWait, label_text: str, value: str) -> None:
    element = wait.until(lambda current: visible_input_for_label(current, label_text))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', element)
    element.clear()
    element.send_keys(value)


def click_visible_button(driver, wait: WebDriverWait, label: str) -> None:
    xpath = f"//button[normalize-space()='{label}']"
    button = wait.until(
        lambda current: next(
            (candidate for candidate in current.find_elements(By.XPATH, xpath) if candidate.is_displayed()),
            None,
        )
    )
    if button is None:
        raise AssertionError(f'Visible button not found: {label}')
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', button)
    wait.until(EC.element_to_be_clickable(button))
    button.click()


def wait_for_url_path(driver, wait: WebDriverWait, expected_path: str) -> None:
    wait.until(lambda current: urlparse(current.current_url).path == expected_path)


def clear_customer_session(driver) -> None:
    driver.get(f'{BASE_URL}/')
    driver.delete_all_cookies()


def install_fetch_recorder(driver) -> None:
    driver.execute_script(
        """
        window.__galantesAuthResponses = [];
        const originalFetch = window.fetch;
        if (!window.__galantesAuthRecorderInstalled) {
          window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            try {
              const target = args[0];
              const url = typeof target === 'string' ? target : (target && target.url) || '';
              if (String(url).includes('/api/auth/customer/register') || String(url).includes('/api/auth/customer/login')) {
                const clone = response.clone();
                const body = await clone.text();
                window.__galantesAuthResponses.push({ url, status: response.status, body });
              }
            } catch (e) {}
            return response;
          };
          window.__galantesAuthRecorderInstalled = true;
        }
        """
    )


def read_latest_auth_response(driver, action: str):
    responses = driver.execute_script('return window.__galantesAuthResponses || [];') or []
    matches = [item for item in responses if f'/api/auth/customer/{action}' in str(item.get('url', ''))]
    if not matches:
        return None
    latest = matches[-1]
    try:
        body = json.loads(latest.get('body') or '{}')
    except Exception:
        body = {'raw': latest.get('body') or ''}
    return {
        'status': latest.get('status'),
        'body': body,
        'url': latest.get('url'),
    }


def main() -> None:
    stamp = datetime.now().strftime('%Y%m%d%H%M%S')
    username = f'qauser{stamp}'
    email = f'qa.register.{stamp}@example.com'
    password = f'GalantesQA!{stamp}'
    full_name = f'QA Register {stamp}'

    report = {
        'status': 'in_progress',
        'base_url': BASE_URL,
        'profile': PROFILE_NAME,
        'headless': HEADLESS,
        'artifacts': str(OUTPUT_DIR),
        'test_user': {
            'username': username,
            'email': email,
            'name': full_name,
        },
        'cases': [],
        'errors': [],
    }

    driver, profile_dir = get_profile_runtime_driver(PROFILE_NAME, headless=HEADLESS)
    if driver is None:
        report['status'] = 'blocked'
        report['errors'].append('Chrome profile is locked. Close Chrome manually and rerun.')
        (OUTPUT_DIR / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print('BLOCKED: Chrome profile is locked. Close Chrome manually and rerun.')
        return

    report['profile_dir'] = str(profile_dir)

    try:
        wait = WebDriverWait(driver, 40)

        clear_customer_session(driver)

        driver.get(f'{BASE_URL}/auth/login?returnTo=/account/orders')
        wait.until(EC.presence_of_element_located((By.TAG_NAME, 'h1')))
        install_fetch_recorder(driver)
        report['cases'].append({
            'name': 'login_page_load',
            'status': 'pass',
            'details': 'Authentication page loaded in production.',
            'evidence': [save_screenshot(driver, '01_auth_page')],
        })

        click_visible_button(driver, wait, 'Register')
        wait.until(lambda current: visible_input_for_label(current, 'Full name'))
        set_input(driver, wait, 'Full name', full_name)
        set_input(driver, wait, 'Username', username)
        set_input(driver, wait, 'Email', email)
        set_input(driver, wait, 'Password', password)
        set_input(driver, wait, 'Confirm password', password)
        save_screenshot(driver, '02_register_form')
        click_visible_button(driver, wait, 'Create account')

        register_response = wait.until(lambda current: read_latest_auth_response(current, 'register'))
        if int(register_response['status']) != 200 or not register_response['body'].get('success'):
            raise AssertionError(f"Registration API failed: {register_response}")
        report['cases'].append({
            'name': 'register_api_response',
            'status': 'pass',
            'details': 'Normal email/password registration returned success from production API.',
            'api_response': register_response,
            'evidence': [save_screenshot(driver, '03_account_orders_after_register')],
        })

        driver.get(f'{BASE_URL}/account/settings')
        wait.until(lambda current: urlparse(current.current_url).path != '/auth/login')
        wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, 'body'), 'Signed in with email and password'))
        if email not in (driver.find_element(By.TAG_NAME, 'body').text or ''):
            raise AssertionError('Registered email was not shown in account settings.')
        report['cases'].append({
            'name': 'account_settings_after_register',
            'status': 'pass',
            'details': 'Account settings confirms password auth and shows the registered email.',
            'evidence': [save_screenshot(driver, '04_account_settings_after_register')],
        })

        clear_customer_session(driver)

        driver.get(f'{BASE_URL}/auth/login?returnTo=/account/orders')
        wait.until(EC.presence_of_element_located((By.TAG_NAME, 'h1')))
        install_fetch_recorder(driver)
        set_input(driver, wait, 'Username or email', username)
        set_input(driver, wait, 'Password', password)
        save_screenshot(driver, '05_login_form')
        click_visible_button(driver, wait, 'Login')

        login_response = wait.until(lambda current: read_latest_auth_response(current, 'login'))
        if int(login_response['status']) != 200 or not login_response['body'].get('success'):
            raise AssertionError(f"Login API failed: {login_response}")
        driver.get(f'{BASE_URL}/account/settings')
        wait.until(lambda current: urlparse(current.current_url).path != '/auth/login')
        wait.until(EC.text_to_be_present_in_element((By.TAG_NAME, 'body'), 'Signed in with email and password'))
        report['cases'].append({
            'name': 'login_with_registered_credentials',
            'status': 'pass',
            'details': 'The same customer can sign in again with normal credentials after logout.',
            'api_response': login_response,
            'evidence': [save_screenshot(driver, '06_account_settings_after_login')],
        })

        report['status'] = 'pass'
        print('PASS: Normal customer registration and login verified in production.')
        print(json.dumps(report['test_user'], indent=2))
    except Exception as error:
        report['status'] = 'fail'
        report['errors'].append(f'{type(error).__name__}: {error}')
        try:
            save_screenshot(driver, '99_failure')
        except Exception:
            pass
        raise
    finally:
        (OUTPUT_DIR / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        time.sleep(2)
        driver.quit()


if __name__ == '__main__':
    main()
