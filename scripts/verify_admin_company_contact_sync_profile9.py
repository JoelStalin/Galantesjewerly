from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

E2E_DIR = Path(__file__).resolve().parent.parent / 'tests' / 'e2e'
if str(E2E_DIR) not in sys.path:
    sys.path.insert(0, str(E2E_DIR))

from profile_runtime import get_driver as get_profile_runtime_driver  # noqa: E402

ADMIN_URL = 'https://admin.galantesjewelry.com/admin/dashboard'
PUBLIC_CONTACT_URL = 'https://galantesjewelry.com/contact'
PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Profile 9')
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME') or 'admin'
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD') or ''

ARTIFACT_DIR = Path(__file__).resolve().parent.parent / 'tests' / 'e2e' / 'artifacts' / f"admin-company-sync-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


def get_driver():
    driver, _ = get_profile_runtime_driver(PROFILE_NAME, headless=False)
    if driver is None:
        print('BLOCKED: Chrome esta abierto con Profile 9. Cierra Chrome manualmente y vuelve a ejecutar.', flush=True)
    return driver


def install_fetch_recorder(driver) -> None:
    driver.execute_script(
        """
        window.__adminContentResponses = [];
        const originalFetch = window.fetch;
        if (!window.__adminContentRecorderInstalled) {
          window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            try {
              const target = args[0];
              const url = typeof target === 'string' ? target : (target && target.url) || '';
              if (String(url).includes('/api/admin/content')) {
                const clone = response.clone();
                const body = await clone.text();
                window.__adminContentResponses.push({ url, status: response.status, body });
              }
            } catch (error) {}
            return response;
          };
          window.__adminContentRecorderInstalled = true;
        }
        """,
    )


def read_latest_content_response(driver):
    responses = driver.execute_script('return window.__adminContentResponses || [];') or []
    if not responses:
        return None
    latest = responses[-1]
    try:
        body = json.loads(latest.get('body') or '{}')
    except Exception:
        body = {'raw': latest.get('body') or ''}
    return {
        'status': int(latest.get('status') or 0),
        'body': body,
    }


def input_after_label(driver, label_text: str):
    xpath = f"//label[contains(normalize-space(.), '{label_text}')]/following-sibling::input[1]"
    candidates = driver.find_elements(By.XPATH, xpath)
    visible = [element for element in candidates if element.is_displayed()]
    if not visible:
        raise AssertionError(f'Visible input not found for label: {label_text}')
    return visible[0]


def set_input(driver, wait: WebDriverWait, label_text: str, value: str) -> None:
    field = wait.until(lambda current: input_after_label(current, label_text))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', field)
    field.clear()
    field.send_keys(value)


def get_input_value(driver, wait: WebDriverWait, label_text: str) -> str:
    field = wait.until(lambda current: input_after_label(current, label_text))
    return field.get_attribute('value') or ''


def login_if_needed(driver, wait: WebDriverWait) -> None:
    driver.get(ADMIN_URL)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))

    if '/admin/login' not in driver.current_url:
        install_fetch_recorder(driver)
        return

    if not ADMIN_PASSWORD:
        raise RuntimeError('ADMIN_PASSWORD is missing for admin login test.')

    username_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='username']")))
    password_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='password']")))
    username_input.clear()
    username_input.send_keys(ADMIN_USERNAME)
    password_input.clear()
    password_input.send_keys(ADMIN_PASSWORD)

    submit_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Unlock Panel']")))
    driver.execute_script('arguments[0].click();', submit_button)
    wait.until(lambda current: '/admin/login' not in current.current_url and '/admin/dashboard' in current.current_url)
    install_fetch_recorder(driver)


def save_settings(driver, wait: WebDriverWait) -> None:
    save_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-testid='admin-save-settings']")))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', save_button)
    driver.execute_script('arguments[0].click();', save_button)
    response = wait.until(lambda current: read_latest_content_response(current))
    if response['status'] != 200 or not response['body'].get('success'):
        raise AssertionError(f'Admin save failed: {response}')
    time.sleep(2)


def assert_public_contact(driver, wait: WebDriverWait, phone: str, address: str) -> None:
    driver.get(PUBLIC_CONTACT_URL)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, 'main')))
    body_text = wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body'))).text
    if phone not in body_text:
        raise AssertionError(f'Public contact page does not show phone {phone!r}.')
    if address not in body_text:
        raise AssertionError(f'Public contact page does not show address {address!r}.')


def save_screenshot(driver, name: str) -> str:
    filename = f'{name}.png'
    driver.save_screenshot(str(ARTIFACT_DIR / filename))
    return filename


def main() -> None:
    report = {
        'status': 'in_progress',
        'profile': PROFILE_NAME,
        'artifacts': str(ARTIFACT_DIR),
        'cases': [],
        'errors': [],
    }

    driver = get_driver()
    if driver is None:
        report['status'] = 'blocked'
        (ARTIFACT_DIR / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps(report, indent=2), flush=True)
        return

    wait = WebDriverWait(driver, 45)
    original_phone = ''
    original_address = ''
    temporary_phone = '(305) 555-2026'
    temporary_address = '999 QA Harbor Drive, Islamorada, FL 33036, United States'
    contact_updated = False
    contact_restored = False

    try:
        login_if_needed(driver, wait)
        original_phone = get_input_value(driver, wait, 'Contact Phone')
        original_address = get_input_value(driver, wait, 'Contact Address')

        set_input(driver, wait, 'Contact Phone', temporary_phone)
        set_input(driver, wait, 'Contact Address', temporary_address)
        save_settings(driver, wait)
        contact_updated = True
        report['cases'].append({
            'name': 'admin_contact_update',
            'status': 'pass',
            'phone': temporary_phone,
            'address': temporary_address,
            'evidence': [save_screenshot(driver, '01_admin_updated')],
        })

        assert_public_contact(driver, wait, temporary_phone, temporary_address)
        report['cases'].append({
            'name': 'public_contact_reflects_update',
            'status': 'pass',
            'evidence': [save_screenshot(driver, '02_public_contact_updated')],
        })

        driver.get(ADMIN_URL)
        install_fetch_recorder(driver)
        set_input(driver, wait, 'Contact Phone', original_phone)
        set_input(driver, wait, 'Contact Address', original_address)
        save_settings(driver, wait)
        contact_restored = True
        report['cases'].append({
            'name': 'admin_contact_restore',
            'status': 'pass',
            'phone': original_phone,
            'address': original_address,
            'evidence': [save_screenshot(driver, '03_admin_restored')],
        })

        assert_public_contact(driver, wait, original_phone, original_address)
        report['cases'].append({
            'name': 'public_contact_restored',
            'status': 'pass',
            'evidence': [save_screenshot(driver, '04_public_contact_restored')],
        })

        report['status'] = 'pass'
    except TimeoutException as error:
        report['status'] = 'fail'
        report['errors'].append(f'TimeoutException: {error}')
        save_screenshot(driver, '99_failure')
        raise
    except Exception as error:
        report['status'] = 'fail'
        report['errors'].append(f'{type(error).__name__}: {error}')
        try:
            save_screenshot(driver, '99_failure')
        except Exception:
            pass
        raise
    finally:
        if contact_updated and not contact_restored and original_phone is not None and original_address is not None:
            try:
                driver.get(ADMIN_URL)
                install_fetch_recorder(driver)
                set_input(driver, wait, 'Contact Phone', original_phone)
                set_input(driver, wait, 'Contact Address', original_address)
                save_settings(driver, wait)
                report['cases'].append({
                    'name': 'admin_contact_restore_finally',
                    'status': 'pass',
                    'phone': original_phone,
                    'address': original_address,
                })
            except Exception as restore_error:
                report['errors'].append(f'Final restore failed: {type(restore_error).__name__}: {restore_error}')
        (ARTIFACT_DIR / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps(report, indent=2), flush=True)
        driver.quit()


if __name__ == '__main__':
    main()
