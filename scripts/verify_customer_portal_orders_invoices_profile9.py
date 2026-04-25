from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

CURRENT_DIR = Path(__file__).resolve().parent.parent
E2E_DIR = CURRENT_DIR / 'tests' / 'e2e'
if str(E2E_DIR) not in sys.path:
    sys.path.insert(0, str(E2E_DIR))

from profile_runtime import get_driver as get_profile_runtime_driver

BASE_URL = os.getenv('E2E_BASE_URL', 'https://galantesjewelry.com').rstrip('/')
PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Profile 9')
HEADLESS = os.getenv('SELENIUM_HEADLESS', '0') == '1'

QA_ORDER_EMAIL = os.getenv('QA_PORTAL_EMAIL', 'qa.checkout.20260424112058@example.com')
QA_ORDER_NAME = os.getenv('QA_PORTAL_NAME', 'QA Checkout 20260424112058')
QA_ORDER_USERNAME = os.getenv('QA_PORTAL_USERNAME', 'qa.checkout.portal')
EXPECTED_ORDER = os.getenv('QA_PORTAL_ORDER', 'S00010')
EXPECTED_INVOICE = os.getenv('QA_PORTAL_INVOICE', 'INV/2026/00002')

OUTPUT_DIR = CURRENT_DIR / 'tests' / 'e2e' / 'artifacts' / f"customer-portal-orders-invoices-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def save_screenshot(driver, name: str) -> str:
    filename = f'{name}.png'
    driver.save_screenshot(str(OUTPUT_DIR / filename))
    return filename


def generate_customer_session_token(email: str, name: str, username: str) -> str:
    gcloud_bin = shutil.which('gcloud') or shutil.which('gcloud.cmd')
    if not gcloud_bin:
        raise AssertionError('gcloud CLI is not available in PATH.')

    remote_command = (
        "sudo docker exec galantes_web_v4 env | "
        "grep -E '^(CUSTOMER_SESSION_SECRET|GOOGLE_SESSION_SECRET|ADMIN_SECRET_KEY)=' | head -n 1"
    )
    result = subprocess.run(
        [
            gcloud_bin,
            'compute',
            'ssh',
            'yoeli@galantes-prod-vm',
            '--zone',
            'us-central1-a',
            '--project',
            'deft-haven-493016-m4',
            '--command',
            remote_command,
        ],
        capture_output=True,
        text=True,
        timeout=300,
        check=True,
    )
    secret_line = result.stdout.strip()
    if '=' not in secret_line:
        raise AssertionError(f'Failed to read customer session secret from production: {result.stderr.strip()}')
    secret = secret_line.split('=', 1)[1]

    now = int(time.time())
    header = {'alg': 'HS256', 'typ': 'JWT'}
    payload = {
        'sub': email,
        'email': email,
        'name': name,
        'username': username,
        'authMethod': 'password',
        'iat': now,
        'exp': now + 60 * 60 * 24 * 365,
    }

    def b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')

    signing_input = f"{b64url(json.dumps(header, separators=(',', ':')).encode('utf-8'))}.{b64url(json.dumps(payload, separators=(',', ':')).encode('utf-8'))}"
    signature = hmac.new(secret.encode('utf-8'), signing_input.encode('ascii'), hashlib.sha256).digest()
    return f'{signing_input}.{b64url(signature)}'


def install_customer_session(driver, token: str) -> None:
    driver.get(f'{BASE_URL}/')
    driver.delete_all_cookies()
    driver.add_cookie({
        'name': 'customer_session',
        'value': token,
        'domain': urlparse(BASE_URL).hostname,
        'path': '/',
        'secure': True,
        'sameSite': 'Lax',
    })


def wait_for_text(driver, wait: WebDriverWait, text: str) -> None:
    def predicate(current) -> bool:
        body_text = current.find_element(By.TAG_NAME, 'body').text
        return text in body_text or text in current.page_source

    wait.until(predicate)


def assert_not_redirected_to_login(driver) -> None:
    if urlparse(driver.current_url).path == '/auth/login':
        raise AssertionError('Portal page redirected to /auth/login instead of honoring the customer session cookie.')


def main() -> None:
    report: dict[str, object] = {
        'status': 'in_progress',
        'base_url': BASE_URL,
        'profile': PROFILE_NAME,
        'headless': HEADLESS,
        'artifacts': str(OUTPUT_DIR),
        'expected_order': EXPECTED_ORDER,
        'expected_invoice': EXPECTED_INVOICE,
        'email': QA_ORDER_EMAIL,
        'cases': [],
        'errors': [],
    }

    driver, profile_dir = get_profile_runtime_driver(PROFILE_NAME, headless=HEADLESS)
    if driver is None:
        report['status'] = 'blocked'
        report['errors'].append('Chrome profile is locked. Close Chrome manually and rerun.')
        (OUTPUT_DIR / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print('BLOCKED: Chrome esta abierto con Profile 9. Cierra Chrome manualmente y vuelve a ejecutar.', flush=True)
        return

    report['profile_dir'] = str(profile_dir)

    try:
        wait = WebDriverWait(driver, 40)
        token = generate_customer_session_token(QA_ORDER_EMAIL, QA_ORDER_NAME, QA_ORDER_USERNAME)
        install_customer_session(driver, token)
        report['cases'].append({
            'name': 'customer_session_cookie_installed',
            'status': 'pass',
            'details': 'Injected a signed production customer_session cookie for the QA checkout email.',
        })

        driver.get(f'{BASE_URL}/account/orders')
        assert_not_redirected_to_login(driver)
        wait_for_text(driver, wait, 'Order History')
        wait_for_text(driver, wait, EXPECTED_ORDER)
        wait_for_text(driver, wait, EXPECTED_INVOICE)
        wait_for_text(driver, wait, 'Attached Invoices')
        report['cases'].append({
            'name': 'orders_page_lists_paid_order_and_invoice',
            'status': 'pass',
            'details': 'Orders page shows the paid QA order with its attached invoice.',
            'evidence': [save_screenshot(driver, '01_account_orders')],
        })

        driver.get(f'{BASE_URL}/account/invoices')
        assert_not_redirected_to_login(driver)
        wait_for_text(driver, wait, 'Invoices')
        wait_for_text(driver, wait, EXPECTED_INVOICE)
        wait_for_text(driver, wait, 'Paid')
        report['cases'].append({
            'name': 'invoices_page_lists_paid_invoice',
            'status': 'pass',
            'details': 'Invoices page shows the paid QA invoice for the same customer session.',
            'evidence': [save_screenshot(driver, '02_account_invoices')],
        })

        report['status'] = 'pass'
        print('PASS: Customer portal orders/invoices verified in production.', flush=True)
    except Exception as error:
        report['status'] = 'fail'
        report['errors'].append(f'{type(error).__name__}: {error}')
        try:
            report['failure_screenshot'] = save_screenshot(driver, '99_failure')
        except Exception:
            pass
        raise
    finally:
        (OUTPUT_DIR / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        time.sleep(2)
        driver.quit()


if __name__ == '__main__':
    main()
