from __future__ import annotations

import json
import os
import sys
import time
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
PUBLIC_URL = 'https://galantesjewelry.com/'
PROFILE_NAME = 'Profile 9'

ADMIN_USERNAME = os.getenv('ADMIN_USERNAME') or 'admin'
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD') or ''


def get_driver():
    driver, _ = get_profile_runtime_driver(PROFILE_NAME, headless=False)
    if driver is None:
        print('BLOCKED: Chrome esta abierto con Profile 9. Cierra Chrome manualmente y vuelve a ejecutar.', flush=True)
    return driver


def set_input(driver, wait: WebDriverWait, test_id: str, value: str) -> None:
    field = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, f"[data-testid='{test_id}']")))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', field)
    field.clear()
    field.send_keys(value)


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
        """
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
        'status': latest.get('status'),
        'body': body,
        'url': latest.get('url'),
    }


def login_if_needed(driver, wait: WebDriverWait) -> None:
    driver.get(ADMIN_URL)
    wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))

    if '/admin/login' not in driver.current_url:
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
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='admin-brand-name']")))
    install_fetch_recorder(driver)


def assert_public_branding(driver, wait: WebDriverWait, expected_name: str, expected_tagline: str) -> None:
    driver.get(PUBLIC_URL)
    name = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='navbar-brand-name']"))).text.strip()
    tagline = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='navbar-brand-tagline']"))).text.strip()
    if name.casefold() != expected_name.casefold() or tagline.casefold() != expected_tagline.casefold():
        raise AssertionError(
            f'Navbar branding mismatch. expected=({expected_name!r}, {expected_tagline!r}) got=({name!r}, {tagline!r})'
        )


def save_branding(driver, wait: WebDriverWait, brand_name: str, brand_tagline: str) -> None:
    driver.get(ADMIN_URL)
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='admin-brand-name']")))
    install_fetch_recorder(driver)
    set_input(driver, wait, 'admin-brand-name', brand_name)
    set_input(driver, wait, 'admin-brand-tagline', brand_tagline)
    save_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "[data-testid='admin-save-settings']")))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', save_button)
    driver.execute_script('arguments[0].click();', save_button)
    response = wait.until(lambda current: read_latest_content_response(current))
    if int(response['status']) != 200 or not response['body'].get('success'):
        raise AssertionError(f'Admin save failed: {response}')
    time.sleep(2)


def main() -> None:
    report = {'status': 'in_progress', 'cases': [], 'errors': []}
    driver = get_driver()
    if driver is None:
        report['status'] = 'blocked'
        print(json.dumps(report, indent=2), flush=True)
        return

    try:
        wait = WebDriverWait(driver, 45)
        login_if_needed(driver, wait)
        report['cases'].append({'name': 'admin_dashboard_access', 'status': 'pass'})

        temporary_name = "Galante's Jewelry Atelier"
        temporary_tagline = 'By The Sea QA'
        final_name = "Galante's Jewelry"
        final_tagline = 'By The Sea'

        save_branding(driver, wait, temporary_name, temporary_tagline)
        assert_public_branding(driver, wait, temporary_name, temporary_tagline)
        report['cases'].append({
            'name': 'temporary_branding_update',
            'status': 'pass',
            'brand_name': temporary_name,
            'brand_tagline': temporary_tagline,
        })

        save_branding(driver, wait, final_name, final_tagline)
        assert_public_branding(driver, wait, final_name, final_tagline)
        report['cases'].append({
            'name': 'final_branding_restore',
            'status': 'pass',
            'brand_name': final_name,
            'brand_tagline': final_tagline,
        })

        report['status'] = 'pass'
        print(json.dumps(report, indent=2), flush=True)
    except TimeoutException as error:
        report['status'] = 'fail'
        report['errors'].append(f'TimeoutException: {error}')
        print(json.dumps(report, indent=2), flush=True)
        raise
    except Exception as error:
        report['status'] = 'fail'
        report['errors'].append(f'{type(error).__name__}: {error}')
        print(json.dumps(report, indent=2), flush=True)
        raise
    finally:
        driver.quit()


if __name__ == '__main__':
    main()
