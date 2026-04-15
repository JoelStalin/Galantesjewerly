from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

CURRENT_DIR = Path(__file__).resolve().parent
ROOT = CURRENT_DIR.parents[1]
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from profile_runtime import get_driver

PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Default')
HEADLESS = os.getenv('SELENIUM_HEADLESS', '0') == '1'
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'galantes2026')
START_SERVER = os.getenv('E2E_START_SERVER', '1') == '1'
DEFAULT_PORT = int(os.getenv('E2E_APPOINTMENT_PORT', '3310'))


def create_artifact_dir() -> Path:
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    artifact_dir = CURRENT_DIR / 'artifacts' / timestamp
    artifact_dir.mkdir(parents=True, exist_ok=True)
    return artifact_dir


def is_port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(('127.0.0.1', port)) == 0


def find_free_port(start_port: int) -> int:
    for port in range(start_port, start_port + 50):
        if not is_port_open(port):
            return port
    raise RuntimeError(f'No free local port found starting at {start_port}.')


class JsonResponse:
    def __init__(self, status: int, headers: dict[str, str], body: str) -> None:
        self.status = status
        self.headers = headers
        self.body = body
        try:
            self.data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            self.data = {'raw': body}


def request_json(method: str, url: str, payload: dict | None = None, cookie: str = '') -> JsonResponse:
    encoded = json.dumps(payload).encode('utf-8') if payload is not None else None
    headers = {'Content-Type': 'application/json'} if payload is not None else {}
    if cookie:
        headers['Cookie'] = cookie
    request = urllib.request.Request(url, data=encoded, method=method, headers=headers)

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return JsonResponse(
                response.status,
                {key.lower(): value for key, value in response.headers.items()},
                response.read().decode('utf-8'),
            )
    except urllib.error.HTTPError as error:
        return JsonResponse(
            error.code,
            {key.lower(): value for key, value in error.headers.items()},
            error.read().decode('utf-8'),
        )


def wait_for_health(base_url: str, timeout_seconds: int = 60) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f'{base_url}/api/health', timeout=5) as response:
                if response.status == 200:
                    return
        except Exception:
            pass
        time.sleep(0.5)
    raise AssertionError(f'Local server did not become healthy at {base_url}.')


def start_next_server(base_url: str, app_data_dir: Path, artifact_dir: Path) -> subprocess.Popen:
    build_id = ROOT / '.next' / 'BUILD_ID'
    if not build_id.exists():
        raise AssertionError('Missing .next build output. Run `npm run build` before this Selenium suite.')

    parsed = urllib.parse.urlparse(base_url)
    port = parsed.port
    if port is None:
        raise AssertionError(f'Base URL must include a port for local server startup: {base_url}')

    next_cli = ROOT / 'node_modules' / 'next' / 'dist' / 'bin' / 'next'
    stdout = (artifact_dir / 'next-start.stdout.log').open('w', encoding='utf-8')
    stderr = (artifact_dir / 'next-start.stderr.log').open('w', encoding='utf-8')

    return subprocess.Popen(
        ['node', str(next_cli), 'start', '-p', str(port)],
        cwd=str(ROOT),
        env={
            **os.environ,
            'APP_DATA_DIR': str(app_data_dir),
            'ADMIN_USERNAME': ADMIN_USERNAME,
            'ADMIN_PASSWORD': ADMIN_PASSWORD,
            'ADMIN_SECRET_KEY': os.getenv('ADMIN_SECRET_KEY', 'e2e_admin_secret_key_32_chars_min'),
            'APPOINTMENT_ENCRYPTION_KEY': os.getenv('APPOINTMENT_ENCRYPTION_KEY', 'e2e_appointment_secret_key_32_chars'),
            'APPOINTMENT_TEST_MODE': os.getenv('APPOINTMENT_TEST_MODE', 'success'),
            'SITE_URL': base_url,
        },
        stdout=stdout,
        stderr=stderr,
    )


def configure_mock_integrations(base_url: str) -> None:
    login_response = request_json(
        'POST',
        f'{base_url}/api/admin/auth',
        {'username': ADMIN_USERNAME, 'password': ADMIN_PASSWORD},
    )
    if login_response.status != 200:
        raise AssertionError(f'Admin login failed while preparing E2E settings: {login_response.body}')

    cookie = (login_response.headers.get('set-cookie') or '').split(';')[0]
    if not cookie.startswith('admin_token='):
        raise AssertionError('Admin login did not return the admin session cookie.')

    private_key = 'fake-private-key-for-selenium'
    smtp_password = 'fake-gmail-app-password-for-selenium'
    save_response = request_json(
        'PUT',
        f'{base_url}/api/admin/integrations',
        {
            'provider': 'appointments',
            'environment': 'development',
            'googleCalendarEnabled': True,
            'googleCalendarId': 'mock-calendar',
            'googleServiceAccountEmail': 'mock-calendar@galantes.iam.gserviceaccount.com',
            'gmailNotificationsEnabled': True,
            'gmailRecipientInbox': 'ceo@galantesjewelry.com',
            'gmailSender': 'joelstalin2105@gmail.com',
            'appointmentDurationMinutes': 60,
            'appointmentTimezone': 'America/New_York',
            'appointmentStartTime': '09:00',
            'appointmentEndTime': '18:00',
            'appointmentSlotIntervalMinutes': 30,
            'appointmentAvailableWeekdays': [0, 1, 2, 3, 4, 5, 6],
            'secrets': {
                'googlePrivateKey': private_key,
                'gmailSmtpPassword': smtp_password,
            },
            'clearSecrets': [],
        },
        cookie,
    )
    if save_response.status != 200:
        raise AssertionError(f'Appointment integration save failed: {save_response.body}')

    read_response = request_json('GET', f'{base_url}/api/admin/integrations', cookie=cookie)
    if read_response.status != 200:
        raise AssertionError(f'Appointment integration read failed: {read_response.body}')
    if private_key in read_response.body or smtp_password in read_response.body:
        raise AssertionError('Sensitive appointment secrets were serialized in the admin response.')


def by_test_id(value: str) -> tuple[str, str]:
    return By.CSS_SELECTOR, f"[data-testid='{value}']"


def save_screenshot(driver, artifact_dir: Path, name: str) -> str:
    file_name = f'{name}.png'
    driver.save_screenshot(str(artifact_dir / file_name))
    return file_name


def set_text(driver, wait: WebDriverWait, test_id: str, value: str) -> None:
    element = wait.until(EC.presence_of_element_located(by_test_id(test_id)))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', element)
    element.clear()
    element.send_keys(value)


def set_native_value(driver, wait: WebDriverWait, test_id: str, value: str) -> None:
    element = wait.until(EC.presence_of_element_located(by_test_id(test_id)))
    driver.execute_script(
        """
        const element = arguments[0];
        const value = arguments[1];
        const prototype = element.tagName === 'TEXTAREA'
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        const setter = descriptor && descriptor.set;
        element.scrollIntoView({ block: 'center' });
        if (setter) {
          setter.call(element, value);
        } else {
          element.value = value;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        """,
        element,
        value,
    )


def submit_contact_form(driver, wait: WebDriverWait, base_url: str, artifact_dir: Path) -> dict:
    requested_date = (datetime.now() + timedelta(days=3)).strftime('%Y-%m-%d')

    driver.get(f'{base_url}/contact')
    wait.until(EC.presence_of_element_located(by_test_id('contact-name')))

    set_text(driver, wait, 'contact-name', 'Selenium Appointment Client')
    set_text(driver, wait, 'contact-email', 'selenium.client@example.com')
    set_text(driver, wait, 'contact-phone', '+13055550123')
    Select(wait.until(EC.presence_of_element_located(by_test_id('contact-inquiry-type')))).select_by_visible_text(
        'Bridal & Engagement',
    )
    set_native_value(driver, wait, 'contact-appointment-date', requested_date)
    wait.until(lambda current: current.find_elements(*by_test_id('contact-slot-10-30')))
    slot_button = wait.until(EC.element_to_be_clickable(by_test_id('contact-slot-10-30')))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', slot_button)
    slot_button.click()
    set_text(driver, wait, 'contact-message', 'Functional Selenium test for Galantes appointment booking.')

    save_screenshot(driver, artifact_dir, '01_contact_form_ready')

    submit_button = wait.until(EC.element_to_be_clickable(by_test_id('contact-submit')))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', submit_button)
    submit_button.click()

    success = wait.until(EC.presence_of_element_located(by_test_id('contact-success')))
    wait.until(lambda current: 'Request Received' in success.text or 'created' in success.text.lower())
    save_screenshot(driver, artifact_dir, '02_contact_form_success')

    return {'appointmentDate': requested_date, 'appointmentTime': '10:30'}


def assert_local_appointment_record(app_data_dir: Path, expected: dict) -> dict:
    appointments_file = app_data_dir / 'appointments.json'
    if not appointments_file.exists():
        raise AssertionError(f'Appointment audit file was not created: {appointments_file}')

    store = json.loads(appointments_file.read_text(encoding='utf-8'))
    records = store.get('records') or []
    if not records:
        raise AssertionError('Appointment audit file does not contain any records.')

    latest = records[0]
    checks = {
        'status': 'email_sent',
        'emailDeliveryStatus': 'sent',
        'appointmentDate': expected['appointmentDate'],
        'appointmentTime': expected['appointmentTime'],
        'timezone': 'America/New_York',
    }
    for field, expected_value in checks.items():
        if latest.get(field) != expected_value:
            raise AssertionError(f'Unexpected {field}: {latest.get(field)!r}, expected {expected_value!r}')

    if not str(latest.get('googleEventId', '')).startswith('mock-event-'):
        raise AssertionError(f"Calendar event ID was not recorded: {latest.get('googleEventId')!r}")
    if not latest.get('googleEventLink'):
        raise AssertionError('Calendar event link was not recorded.')
    if latest.get('odooSyncStatus') != 'synced':
        raise AssertionError(f"Unexpected Odoo sync status: {latest.get('odooSyncStatus')!r}")
    if not str(latest.get('odooAppointmentId', '')).startswith('mock-odoo-'):
        raise AssertionError(f"Odoo appointment ID was not recorded: {latest.get('odooAppointmentId')!r}")

    return latest


def main() -> None:
    artifact_dir = create_artifact_dir()
    app_data_dir = Path(os.getenv('E2E_APP_DATA_DIR', str(artifact_dir / 'app-data')))
    app_data_dir.mkdir(parents=True, exist_ok=True)

    if os.getenv('E2E_BASE_URL'):
        base_url = os.getenv('E2E_BASE_URL', '').rstrip('/')
    else:
        port = find_free_port(DEFAULT_PORT)
        base_url = f'http://127.0.0.1:{port}'

    server = None
    driver = None
    report = {
        'status': 'in_progress',
        'base_url': base_url,
        'profile_name': PROFILE_NAME,
        'artifact_dir': str(artifact_dir),
        'app_data_dir': str(app_data_dir),
        'gmail_sender': 'joelstalin2105@gmail.com',
        'gmail_recipient': 'ceo@galantesjewelry.com',
        'test_mode': os.getenv('APPOINTMENT_TEST_MODE', 'success'),
        'cases': [],
        'errors': [],
    }

    try:
        print(f'Artifacts will be stored in {artifact_dir}')
        if START_SERVER:
            print(f'Starting local Next.js server at {base_url}')
            server = start_next_server(base_url, app_data_dir, artifact_dir)

        wait_for_health(base_url)
        configure_mock_integrations(base_url)
        report['cases'].append({
            'name': 'admin_integration_settings',
            'status': 'pass',
            'details': 'Saved Calendar sender and recipient settings with masked secrets.',
        })

        driver, profile_dir = get_driver(PROFILE_NAME, headless=HEADLESS)
        if driver is None:
            report['status'] = 'blocked'
            report['errors'].append('Chrome profile is locked. Close Chrome manually and rerun the suite.')
            return

        report['profile_path'] = str(profile_dir)
        wait = WebDriverWait(driver, 30)
        expected = submit_contact_form(driver, wait, base_url, artifact_dir)
        report['cases'].append({
            'name': 'frontend_contact_submit',
            'status': 'pass',
            'details': 'Submitted the public contact form and received a successful appointment confirmation.',
            'evidence': ['01_contact_form_ready.png', '02_contact_form_success.png'],
        })

        latest_record = assert_local_appointment_record(app_data_dir, expected)
        report['latest_record'] = {
            'id': latest_record['id'],
            'status': latest_record['status'],
            'googleEventId': latest_record['googleEventId'],
            'odooAppointmentId': latest_record['odooAppointmentId'],
            'odooSyncStatus': latest_record['odooSyncStatus'],
            'emailDeliveryStatus': latest_record['emailDeliveryStatus'],
            'timezone': latest_record['timezone'],
        }
        report['cases'].append({
            'name': 'calendar_and_gmail_pipeline',
            'status': 'pass',
            'details': 'Mock Calendar event, Odoo sync, and Gmail delivery were recorded by the backend audit log.',
        })
        report['status'] = 'pass'
        print('Appointment frontend Selenium suite completed successfully.')
    except Exception as error:
        report['status'] = 'fail'
        message = f'{type(error).__name__}: {error}'
        report['errors'].append(message)
        print(message)
        if driver is not None:
            try:
                save_screenshot(driver, artifact_dir, '99_failure')
            except Exception as screenshot_error:
                report['errors'].append(f'Unable to capture failure screenshot: {screenshot_error}')
        raise
    finally:
        if driver is not None:
            try:
                browser_logs = driver.get_log('browser')
                if browser_logs:
                    formatted = [
                        f"{entry.get('level', 'INFO')}: {entry.get('message', '')}"
                        for entry in browser_logs
                    ]
                    (artifact_dir / 'browser-console.log').write_text('\n'.join(formatted) + '\n', encoding='utf-8')
            except Exception:
                pass
            driver.quit()

        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()

        (artifact_dir / 'result.json').write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )


if __name__ == '__main__':
    main()
