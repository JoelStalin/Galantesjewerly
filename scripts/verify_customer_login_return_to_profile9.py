from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

from selenium.common.exceptions import TimeoutException
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

OUTPUT_DIR = CURRENT_DIR / 'tests' / 'e2e' / 'artifacts' / f"customer-login-returnto-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def save_screenshot(driver, name: str) -> str:
    filename = f'{name}.png'
    driver.save_screenshot(str(OUTPUT_DIR / filename))
    return filename


def visible_input_for_label(driver, label_text: str):
    xpath = f"//label[normalize-space()='{label_text}']/following-sibling::input"
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
    driver.execute_script('arguments[0].click();', button)


def click_visible_link(driver, wait: WebDriverWait, label: str) -> None:
    xpath = f"//a[normalize-space()='{label}']"
    link = wait.until(
        lambda current: next(
            (candidate for candidate in current.find_elements(By.XPATH, xpath) if candidate.is_displayed()),
            None,
        )
    )
    if link is None:
        raise AssertionError(f'Visible link not found: {label}')
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', link)
    wait.until(EC.element_to_be_clickable(link))
    driver.execute_script('arguments[0].click();', link)


def clear_customer_session(driver) -> None:
    driver.get(f'{BASE_URL}/')
    driver.delete_all_cookies()
    driver.execute_script("localStorage.removeItem('galantes_cart');")


def seed_cart(driver) -> None:
    driver.get(f'{BASE_URL}/')
    driver.execute_script(
        """
        localStorage.setItem('galantes_cart', JSON.stringify([
          {
            id: 'qa-item-1',
            slug: 'qa-coral-ring',
            name: 'QA Coral Ring',
            price: 275,
            quantity: 1,
            image_url: ''
          }
        ]));
        """
    )


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


def get_current_path(driver) -> str:
    return urlparse(driver.current_url).path


def get_return_to_target(driver) -> str:
    parsed = urlparse(driver.current_url)
    query = parse_qs(parsed.query)
    return unquote(query.get('returnTo', [''])[0] or '')


def collect_browser_logs(driver) -> list[str]:
    logs: list[str] = []
    try:
      entries = driver.get_log('browser')
    except Exception:
      return logs

    for entry in entries:
        logs.append(f"{entry.get('level')}: {entry.get('message')}")
    return logs


def dump_browser_logs(driver, prefix: str) -> None:
    for line in collect_browser_logs(driver):
        print(f'[{prefix}] {line}', flush=True)


def main() -> None:
    stamp = datetime.now().strftime('%Y%m%d%H%M%S')
    username = f'qalogin{stamp}'
    email = f'qa.login.returnto.{stamp}@example.com'
    password = f'GalantesQA!{stamp}'
    full_name = f'QA Login ReturnTo {stamp}'

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
        print('BLOCKED: Chrome profile is locked. Close Chrome manually and rerun.', flush=True)
        return

    report['profile_dir'] = str(profile_dir)

    try:
        wait = WebDriverWait(driver, 40)
        driver.set_page_load_timeout(45)

        clear_customer_session(driver)
        seed_cart(driver)

        driver.get(f'{BASE_URL}/cart')
        wait.until(EC.presence_of_element_located((By.TAG_NAME, 'h1')))
        install_fetch_recorder(driver)
        if get_current_path(driver) != '/cart':
            raise AssertionError(f'Expected cart page before login, got {driver.current_url}')
        report['cases'].append({
            'name': 'cart_page_loaded',
            'status': 'pass',
            'details': 'Cart page loaded with seeded cart state.',
            'evidence': [save_screenshot(driver, '01_cart_before_login')],
        })

        click_visible_link(driver, wait, 'Login')
        wait.until(lambda current: get_current_path(current) == '/auth/login')
        install_fetch_recorder(driver)
        if get_return_to_target(driver) != '/cart':
            raise AssertionError(f'Login link did not preserve returnTo=/cart. Current URL: {driver.current_url}')
        report['cases'].append({
            'name': 'login_link_preserves_return_to_cart',
            'status': 'pass',
            'details': 'Navbar login link preserved the current cart URL.',
            'evidence': [save_screenshot(driver, '02_login_page_from_cart')],
        })
        dump_browser_logs(driver, 'cart-login-link')

        click_visible_button(driver, wait, 'Register')
        wait.until(lambda current: visible_input_for_label(current, 'Full name'))
        set_input(driver, wait, 'Full name', full_name)
        set_input(driver, wait, 'Username', username)
        set_input(driver, wait, 'Email', email)
        set_input(driver, wait, 'Password', password)
        set_input(driver, wait, 'Confirm password', password)
        click_visible_button(driver, wait, 'Create account')
        wait.until(lambda current: get_current_path(current) == '/cart')
        report['cases'].append({
            'name': 'register_returns_to_cart',
            'status': 'pass',
            'details': 'New account registration returned the browser to the cart page.',
            'evidence': [save_screenshot(driver, '03_cart_after_register')],
        })
        dump_browser_logs(driver, 'register-return')

        driver.get(f'{BASE_URL}/auth/logout')
        wait.until(lambda current: get_current_path(current) == '/')
        report['cases'].append({
            'name': 'logout_clears_session',
            'status': 'pass',
            'details': 'Explicit logout returned the browser to the public home page.',
            'evidence': [save_screenshot(driver, '04_after_logout')],
        })
        dump_browser_logs(driver, 'logout')

        driver.get(f'{BASE_URL}/account/orders')
        wait.until(lambda current: get_current_path(current) == '/auth/login')
        report['cases'].append({
            'name': 'logout_blocks_account_pages',
            'status': 'pass',
            'details': 'After logout, protected account pages redirect back to login.',
            'evidence': [save_screenshot(driver, '05_orders_after_logout')],
        })
        dump_browser_logs(driver, 'logout-block')

        report['status'] = 'pass'
        print(json.dumps(report, indent=2), flush=True)
    except Exception as error:
        report['status'] = 'fail'
        report['errors'].append(f'{type(error).__name__}: {error}')
        try:
            save_screenshot(driver, '99_failure')
        except Exception:
            pass
        dump_browser_logs(driver, 'failure')
        print(json.dumps(report, indent=2), flush=True)
        raise
    finally:
        (OUTPUT_DIR / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        time.sleep(2)
        driver.quit()


if __name__ == '__main__':
    main()
