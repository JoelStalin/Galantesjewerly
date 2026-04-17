from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from profile_runtime import get_driver

BASE_URL = os.getenv('E2E_BASE_URL', 'https://galantesjewelry.com').rstrip('/')
ADMIN_BASE_URL = os.getenv('E2E_ADMIN_BASE_URL', 'https://admin.galantesjewelry.com').rstrip('/')
PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Default')
HEADLESS = os.getenv('SELENIUM_HEADLESS', '0') == '1'
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', '')
EXPECTED_REDIRECT_URI = os.getenv(
    'EXPECTED_ADMIN_GOOGLE_REDIRECT_URI',
    'https://admin.galantesjewelry.com/api/admin/google/oauth/callback',
)


def ensure(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def click(driver, wait: WebDriverWait, selector: str) -> None:
    element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, selector)))
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    try:
        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector))).click()
    except Exception:
        driver.execute_script("arguments[0].click();", element)


def login_if_needed(driver, wait: WebDriverWait) -> None:
    driver.get(f'{ADMIN_BASE_URL}/admin/dashboard?tab=integrations')
    wait.until(lambda current: '/admin/login' in current.current_url or '/admin/dashboard' in current.current_url)

    if '/admin/dashboard' in driver.current_url:
        return

    ensure(bool(ADMIN_PASSWORD), 'ADMIN_PASSWORD is required to run the admin OAuth smoke test.')
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='login-username']"))).clear()
    driver.find_element(By.CSS_SELECTOR, "[data-testid='login-username']").send_keys(ADMIN_USERNAME)
    driver.find_element(By.CSS_SELECTOR, "[data-testid='login-password']").clear()
    driver.find_element(By.CSS_SELECTOR, "[data-testid='login-password']").send_keys(ADMIN_PASSWORD)
    click(driver, wait, "[data-testid='login-submit']")
    wait.until(lambda current: '/admin/dashboard' in current.current_url)


def main() -> None:
    driver, profile_dir = get_driver(PROFILE_NAME, headless=HEADLESS)
    if driver is None:
        return

    print(f'Profile path: {profile_dir}')
    try:
        wait = WebDriverWait(driver, 30)

        driver.get(f'{BASE_URL}/')
        wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid^='featured-public-card-']")),
        )
        print('Public storefront rendered successfully.')

        login_if_needed(driver, wait)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='tab-integrations']")))
        click(driver, wait, "[data-testid='tab-integrations']")
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='integrations-panel']")))

        click(driver, wait, "[data-testid='integration-env-production']")
        wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='connect-google-owner-oauth']")),
        )

        click(driver, wait, "[data-testid='connect-google-owner-oauth']")

        try:
            wait.until(lambda current: 'accounts.google.com' in current.current_url)
        except TimeoutException as exc:
            raise AssertionError(f'Google OAuth page did not open. Current URL: {driver.current_url}') from exc

        parsed = urlparse(driver.current_url)
        query = parse_qs(parsed.query)
        redirect_uri = (query.get('redirect_uri') or [''])[0]
        client_id = (query.get('client_id') or [''])[0]

        ensure(
            parsed.netloc == 'accounts.google.com',
            f'Unexpected Google OAuth host: {parsed.netloc}',
        )
        ensure(
            redirect_uri == EXPECTED_REDIRECT_URI,
            f'Unexpected redirect_uri. Expected {EXPECTED_REDIRECT_URI}, got {redirect_uri}',
        )
        ensure(bool(client_id), 'Google OAuth URL is missing client_id.')

        print('Admin OAuth button opened Google correctly.')
        print(f'Google client_id present: {client_id[:24]}...')
        print(f'redirect_uri: {redirect_uri}')
    finally:
        driver.quit()


if __name__ == '__main__':
    main()
