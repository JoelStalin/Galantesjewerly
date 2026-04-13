from __future__ import annotations

import email
import imaplib
import json
import os
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from email import policy
from email.message import Message
from pathlib import Path
from zoneinfo import ZoneInfo

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from profile_runtime import get_driver

BASE_URL = os.getenv('E2E_BASE_URL', 'https://galantesjewelry.com').rstrip('/')
ENVIRONMENT = os.getenv('E2E_INTEGRATION_ENVIRONMENT', 'production')
PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Default')
HEADLESS = os.getenv('SELENIUM_HEADLESS', '0') == '1'
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'galantes2026')
ALLOW_REAL_SEND = os.getenv('E2E_PRODUCTION_REAL_SEND', '0') == '1'

EXPECTED_GMAIL_SENDER = os.getenv('GMAIL_E2E_EXPECTED_SENDER', 'joelstalin2105@gmail.com')
EXPECTED_GMAIL_RECIPIENT = os.getenv('GMAIL_RECEIPT_USER', 'ceo@galantesjewelry.com')
IMAP_APP_PASSWORD = os.getenv('GMAIL_RECEIPT_IMAP_APP_PASSWORD', '')
IMAP_HOST = os.getenv('GMAIL_RECEIPT_IMAP_HOST', 'imap.gmail.com')
IMAP_FOLDER = os.getenv('GMAIL_RECEIPT_IMAP_FOLDER', 'INBOX')
IMAP_TIMEOUT_SECONDS = int(os.getenv('GMAIL_RECEIPT_TIMEOUT_SECONDS', '180'))

CONTACT_CLIENT_EMAIL = os.getenv('E2E_CONTACT_CLIENT_EMAIL', 'e2e.galantes@example.com')
CONTACT_CLIENT_PHONE = os.getenv('E2E_CONTACT_CLIENT_PHONE', '+13055550123')
APPOINTMENT_TIMEZONE = os.getenv('E2E_APPOINTMENT_TIMEZONE', 'America/New_York')


class JsonResponse:
    def __init__(self, status: int, headers: dict[str, str], body: str) -> None:
        self.status = status
        self.headers = headers
        self.body = body
        try:
            self.data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            self.data = {'raw': body}


def create_artifact_dir() -> Path:
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    artifact_dir = CURRENT_DIR / 'artifacts' / f'{timestamp}_prod_appointments'
    artifact_dir.mkdir(parents=True, exist_ok=True)
    return artifact_dir


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


def request_json(method: str, url: str, payload: dict | None = None, cookie: str = '') -> JsonResponse:
    encoded = json.dumps(payload).encode('utf-8') if payload is not None else None
    headers = {
        'Accept': 'application/json',
        'User-Agent': 'GalantesAppointmentsE2E/1.0',
    }
    if payload is not None:
        headers['Content-Type'] = 'application/json'
    if cookie:
        headers['Cookie'] = cookie

    request = urllib.request.Request(url, data=encoded, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return JsonResponse(
                response.status,
                {key.lower(): value for key, value in response.headers.items()},
                response.read().decode('utf-8'),
            )
    except urllib.error.HTTPError as error:
        return JsonResponse(
            error.code,
            {key.lower(): value for key, value in error.headers.items()},
            error.read().decode('utf-8', errors='replace'),
        )


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
        element.scrollIntoView({ block: 'center' });
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        """,
        element,
        value,
    )


def parse_admin_cookie(response: JsonResponse) -> str:
    cookie = (response.headers.get('set-cookie') or '').split(';')[0]
    if not cookie.startswith('admin_token='):
        raise AssertionError('Admin login did not return an admin session cookie.')
    return cookie


def get_secret_state(config: dict, field: str) -> dict:
    return ((config.get('secrets') or {}).get(field) or {})


def admin_preflight(report: dict, artifact_dir: Path) -> str | None:
    health = request_json('GET', f'{BASE_URL}/api/health')
    report['health'] = {'status': health.status, 'body': health.data}
    if health.status != 200:
        return f'Production health check failed with HTTP {health.status}.'

    login = request_json(
        'POST',
        f'{BASE_URL}/api/admin/auth',
        {'username': ADMIN_USERNAME, 'password': ADMIN_PASSWORD},
    )
    if login.status != 200:
        return f'Admin login failed with HTTP {login.status}. Set ADMIN_USERNAME/ADMIN_PASSWORD locally.'
    cookie = parse_admin_cookie(login)

    integrations = request_json('GET', f'{BASE_URL}/api/admin/integrations', cookie=cookie)
    write_json(artifact_dir / 'admin-integrations.masked.json', integrations.data)
    if integrations.status != 200:
        return f'Admin integrations read failed with HTTP {integrations.status}.'

    serialized = integrations.body
    if 'BEGIN PRIVATE KEY' in serialized or IMAP_APP_PASSWORD and IMAP_APP_PASSWORD in serialized:
        return 'Admin integrations response serialized a sensitive secret.'

    configs = integrations.data.get('appointmentConfigs') or []
    config = next((item for item in configs if item.get('environment') == ENVIRONMENT), None)
    if not config:
        return f'No appointments integration config found for environment {ENVIRONMENT!r}.'

    missing = []
    if not config.get('googleCalendarEnabled'):
        missing.append('Google Calendar enabled')
    if not config.get('googleCalendarId'):
        missing.append('Google Calendar ID')
    if not config.get('googleServiceAccountEmail'):
        missing.append('Google service account email')
    if not get_secret_state(config, 'googlePrivateKey').get('isSet'):
        missing.append('Google private key')
    if not config.get('gmailNotificationsEnabled'):
        missing.append('Gmail notifications enabled')
    if (config.get('gmailRecipientInbox') or '').lower() != EXPECTED_GMAIL_RECIPIENT.lower():
        missing.append(f'Gmail recipient inbox = {EXPECTED_GMAIL_RECIPIENT}')
    if (config.get('gmailSender') or '').lower() != EXPECTED_GMAIL_SENDER.lower():
        missing.append(f'Gmail sender = {EXPECTED_GMAIL_SENDER}')
    if not get_secret_state(config, 'gmailSmtpPassword').get('isSet'):
        missing.append('Gmail SMTP App Password')

    report['admin_config'] = {
        'environment': config.get('environment'),
        'googleCalendarEnabled': config.get('googleCalendarEnabled'),
        'googleCalendarIdSet': bool(config.get('googleCalendarId')),
        'googleServiceAccountEmailSet': bool(config.get('googleServiceAccountEmail')),
        'googlePrivateKeySet': bool(get_secret_state(config, 'googlePrivateKey').get('isSet')),
        'gmailNotificationsEnabled': config.get('gmailNotificationsEnabled'),
        'gmailRecipientInbox': config.get('gmailRecipientInbox'),
        'gmailSender': config.get('gmailSender'),
        'gmailSmtpPasswordSet': bool(get_secret_state(config, 'gmailSmtpPassword').get('isSet')),
        'appointmentDurationMinutes': config.get('appointmentDurationMinutes'),
        'appointmentTimezone': config.get('appointmentTimezone'),
    }

    if missing:
        return 'Production admin config is incomplete: ' + ', '.join(missing) + '.'

    test_response = request_json(
        'POST',
        f'{BASE_URL}/api/admin/integrations/test',
        {'provider': 'appointments', 'environment': ENVIRONMENT},
        cookie=cookie,
    )
    write_json(artifact_dir / 'admin-integrations-test.json', test_response.data)
    if test_response.status != 200 or not test_response.data.get('ok'):
        return f'Appointments integration test failed with HTTP {test_response.status}: {test_response.body[:500]}'

    report['cases'].append({
        'name': 'production_preflight',
        'status': 'pass',
        'details': 'Health, admin masked settings, Calendar test, and Gmail SMTP test passed.',
    })
    return None


def verify_imap_login() -> str | None:
    if not IMAP_APP_PASSWORD:
        return (
            'Missing GMAIL_RECEIPT_IMAP_APP_PASSWORD. Use an App Password for '
            f'{EXPECTED_GMAIL_RECIPIENT}; do not use the normal Gmail password.'
        )

    mailbox = None
    try:
        mailbox = imaplib.IMAP4_SSL(IMAP_HOST, 993, timeout=30)
        mailbox.login(EXPECTED_GMAIL_RECIPIENT, IMAP_APP_PASSWORD)
        mailbox.select(IMAP_FOLDER)
        return None
    except Exception as error:
        return f'IMAP login/select failed for {EXPECTED_GMAIL_RECIPIENT}: {type(error).__name__}: {error}'
    finally:
        if mailbox is not None:
            try:
                mailbox.logout()
            except Exception:
                pass


def slot_candidates() -> list[tuple[str, str]]:
    try:
        timezone = ZoneInfo(APPOINTMENT_TIMEZONE)
        now = datetime.now(timezone)
    except Exception:
        now = datetime.now()
    slots: list[tuple[str, str]] = []
    times = ['10:00', '11:30', '13:00', '14:30', '16:00']

    for day_offset in range(2, 18):
        current_date = (now + timedelta(days=day_offset)).date()
        if current_date.weekday() >= 5:
            continue
        for appointment_time in times:
            slots.append((current_date.isoformat(), appointment_time))

    return slots


def check_availability(appointment_date: str, appointment_time: str) -> JsonResponse:
    query = urllib.parse.urlencode({
        'appointmentDate': appointment_date,
        'appointmentTime': appointment_time,
    })
    return request_json('GET', f'{BASE_URL}/api/contact/availability?{query}')


def find_available_slot(report: dict) -> dict:
    first_error = ''
    checked = 0
    for appointment_date, appointment_time in slot_candidates():
        checked += 1
        response = check_availability(appointment_date, appointment_time)
        if response.status != 200:
            first_error = first_error or response.body[:500]
            continue
        if response.data.get('available') is True:
            slot = {
                'appointmentDate': appointment_date,
                'appointmentTime': appointment_time,
                'timezone': response.data.get('timezone') or APPOINTMENT_TIMEZONE,
                'durationMinutes': response.data.get('durationMinutes') or 60,
                'checkedCandidates': checked,
            }
            report['cases'].append({
                'name': 'availability_slot_search',
                'status': 'pass',
                'details': f"Selected {appointment_date} {appointment_time} after {checked} checks.",
            })
            return slot

    raise AssertionError(f'No available appointment slot found. First availability error: {first_error}')


def install_fetch_recorder(driver) -> None:
    driver.execute_script(
        """
        window.__galantesContactResponses = [];
        if (!window.__galantesFetchRecorderInstalled) {
          window.__galantesFetchRecorderInstalled = true;
          const originalFetch = window.fetch.bind(window);
          window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            try {
              const target = args[0];
              const url = typeof target === 'string' ? target : (target && target.url) || '';
              if (String(url).includes('/api/contact')) {
                const body = await response.clone().text();
                window.__galantesContactResponses.push({
                  url: String(url),
                  status: response.status,
                  body,
                });
              }
            } catch (error) {
              window.__galantesContactResponses.push({
                url: 'capture-error',
                status: 0,
                body: String(error),
              });
            }
            return response;
          };
        }
        """,
    )


def read_contact_response(driver, allow_missing: bool = False) -> dict | None:
    responses = driver.execute_script('return window.__galantesContactResponses || [];')
    contact_responses = [
        item for item in responses
        if '/api/contact' in str(item.get('url')) and '/availability' not in str(item.get('url'))
    ]
    if not contact_responses:
        if allow_missing:
            return None
        raise AssertionError('The browser did not capture the /api/contact response.')

    latest = contact_responses[-1]
    body = latest.get('body') or ''
    try:
        payload = json.loads(body) if body else {}
    except json.JSONDecodeError:
        payload = {'raw': body}

    return {
        'status': latest.get('status'),
        'body': payload,
    }


def submit_contact_form(driver, artifact_dir: Path, marker: str, slot: dict) -> dict:
    wait = WebDriverWait(driver, 45)
    driver.get(f'{BASE_URL}/contact')
    wait.until(EC.presence_of_element_located(by_test_id('contact-name')))
    install_fetch_recorder(driver)

    set_text(driver, wait, 'contact-name', 'Galantes E2E Appointment Test')
    set_text(driver, wait, 'contact-email', CONTACT_CLIENT_EMAIL)
    set_text(driver, wait, 'contact-phone', CONTACT_CLIENT_PHONE)
    Select(wait.until(EC.presence_of_element_located(by_test_id('contact-inquiry-type')))).select_by_visible_text(
        'General Inquiry',
    )
    set_native_value(driver, wait, 'contact-appointment-date', slot['appointmentDate'])
    set_native_value(driver, wait, 'contact-appointment-time', slot['appointmentTime'])
    set_text(
        driver,
        wait,
        'contact-message',
        f'{marker} - Production E2E test appointment. Please ignore; generated by controlled test automation.',
    )

    save_screenshot(driver, artifact_dir, '01_contact_form_ready')
    submit_button = wait.until(EC.element_to_be_clickable(by_test_id('contact-submit')))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', submit_button)
    submit_button.click()

    success = wait.until(EC.presence_of_element_located(by_test_id('contact-success')))
    wait.until(lambda _: 'request received' in success.text.lower() or 'appointment' in success.text.lower())
    save_screenshot(driver, artifact_dir, '02_contact_form_success')

    response = wait.until(lambda current: read_contact_response(current, allow_missing=True))
    if response is None:
        raise AssertionError('The browser did not capture the /api/contact response.')
    if response['status'] != 200 or not response['body'].get('success'):
        raise AssertionError(f"Contact API did not succeed: {json.dumps(response, ensure_ascii=False)[:1000]}")
    if not response['body'].get('appointmentId'):
        raise AssertionError('Contact API did not return appointmentId.')
    if not response['body'].get('googleEventLink'):
        raise AssertionError('Contact API did not return googleEventLink.')

    return response


def message_text(message: Message) -> str:
    chunks = [
        str(message.get('subject', '')),
        str(message.get('from', '')),
        str(message.get('to', '')),
        str(message.get('date', '')),
    ]

    if message.is_multipart():
        for part in message.walk():
            disposition = str(part.get('Content-Disposition', '')).lower()
            if 'attachment' in disposition:
                continue
            if part.get_content_type() in {'text/plain', 'text/html'}:
                try:
                    chunks.append(str(part.get_content()))
                except Exception:
                    payload = part.get_payload(decode=True)
                    if payload:
                        chunks.append(payload.decode(part.get_content_charset() or 'utf-8', errors='replace'))
    else:
        try:
            chunks.append(str(message.get_content()))
        except Exception:
            payload = message.get_payload(decode=True)
            if payload:
                chunks.append(payload.decode(message.get_content_charset() or 'utf-8', errors='replace'))

    return '\n'.join(chunks)


def fetch_recent_messages(mailbox: imaplib.IMAP4_SSL, since_date: str) -> list[Message]:
    status, data = mailbox.search(None, 'SINCE', since_date)
    if status != 'OK' or not data or not data[0]:
        return []

    message_ids = data[0].split()
    recent_ids = message_ids[-80:]
    messages: list[Message] = []
    for message_id in reversed(recent_ids):
        fetch_status, fetch_data = mailbox.fetch(message_id, '(RFC822)')
        if fetch_status != 'OK':
            continue
        for item in fetch_data:
            if isinstance(item, tuple) and item[1]:
                messages.append(email.message_from_bytes(item[1], policy=policy.default))
    return messages


def wait_for_gmail_receipt(marker: str, artifact_dir: Path) -> dict:
    since_date = (datetime.now() - timedelta(days=1)).strftime('%d-%b-%Y')
    deadline = time.time() + IMAP_TIMEOUT_SECONDS
    last_error = ''

    while time.time() < deadline:
        mailbox = None
        try:
            mailbox = imaplib.IMAP4_SSL(IMAP_HOST, 993, timeout=30)
            mailbox.login(EXPECTED_GMAIL_RECIPIENT, IMAP_APP_PASSWORD)
            mailbox.select(IMAP_FOLDER)

            for message in fetch_recent_messages(mailbox, since_date):
                text = message_text(message)
                if marker in text:
                    found = {
                        'subject': str(message.get('subject', '')),
                        'from': str(message.get('from', '')),
                        'to': str(message.get('to', '')),
                        'date': str(message.get('date', '')),
                        'messageId': str(message.get('message-id', '')),
                    }
                    write_json(artifact_dir / 'gmail-receipt-found.json', found)
                    return found
        except Exception as error:
            last_error = f'{type(error).__name__}: {error}'
        finally:
            if mailbox is not None:
                try:
                    mailbox.logout()
                except Exception:
                    pass

        time.sleep(10)

    raise AssertionError(
        f'Message marker {marker} was not found in {EXPECTED_GMAIL_RECIPIENT} '
        f'within {IMAP_TIMEOUT_SECONDS}s. Last IMAP error: {last_error}'
    )


def verify_slot_busy(slot: dict) -> None:
    response = check_availability(slot['appointmentDate'], slot['appointmentTime'])
    if response.status != 200:
        raise AssertionError(f"Availability recheck failed with HTTP {response.status}: {response.body[:500]}")
    if response.data.get('available') is not False:
        raise AssertionError('The submitted appointment slot is still reported as available.')


def write_report_md(artifact_dir: Path, report: dict) -> None:
    lines = [
        '# Production Appointment E2E',
        '',
        f"- Status: `{report.get('status')}`",
        f"- Base URL: `{report.get('base_url')}`",
        f"- Environment: `{report.get('environment')}`",
        f"- Marker: `{report.get('marker', '')}`",
        f"- Gmail recipient: `{EXPECTED_GMAIL_RECIPIENT}`",
        '',
        '## Cases',
    ]
    for case in report.get('cases', []):
        lines.append(f"- `{case.get('status')}` {case.get('name')}: {case.get('details')}")
    if report.get('blocked_reasons'):
        lines.extend(['', '## Blocked Reasons'])
        lines.extend(f"- {reason}" for reason in report['blocked_reasons'])
    if report.get('errors'):
        lines.extend(['', '## Errors'])
        lines.extend(f"- {error}" for error in report['errors'])
    (artifact_dir / 'report.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main() -> None:
    artifact_dir = create_artifact_dir()
    marker = 'GALANTES-E2E-' + datetime.now().strftime('%Y%m%d%H%M%S') + '-' + secrets.token_hex(3).upper()
    driver = None
    report = {
        'status': 'in_progress',
        'base_url': BASE_URL,
        'environment': ENVIRONMENT,
        'profile_name': PROFILE_NAME,
        'headless': HEADLESS,
        'real_send_enabled': ALLOW_REAL_SEND,
        'marker': marker,
        'artifact_dir': str(artifact_dir),
        'cases': [],
        'blocked_reasons': [],
        'errors': [],
    }

    try:
        print(f'Artifacts will be stored in {artifact_dir}')
        blocked_reason = admin_preflight(report, artifact_dir)
        if blocked_reason:
            report['status'] = 'blocked'
            report['blocked_reasons'].append(blocked_reason)
            print(f'BLOCKED: {blocked_reason}')
            return

        imap_reason = verify_imap_login()
        if imap_reason:
            report['status'] = 'blocked'
            report['blocked_reasons'].append(imap_reason)
            print(f'BLOCKED: {imap_reason}')
            return
        report['cases'].append({
            'name': 'imap_login',
            'status': 'pass',
            'details': f'IMAP login succeeded for {EXPECTED_GMAIL_RECIPIENT}.',
        })

        if not ALLOW_REAL_SEND:
            reason = 'Set E2E_PRODUCTION_REAL_SEND=1 to create a real Calendar event and send a real Gmail message.'
            report['status'] = 'blocked'
            report['blocked_reasons'].append(reason)
            print(f'BLOCKED: {reason}')
            return

        slot = find_available_slot(report)
        report['selected_slot'] = slot

        driver, profile_dir = get_driver(PROFILE_NAME, headless=HEADLESS)
        if driver is None:
            report['status'] = 'blocked'
            report['blocked_reasons'].append('Chrome profile is locked. Close Chrome manually and rerun the suite.')
            return
        report['profile_path'] = str(profile_dir)

        contact_response = submit_contact_form(driver, artifact_dir, marker, slot)
        write_json(artifact_dir / 'contact-response.json', contact_response)
        report['contact_response'] = {
            'status': contact_response['status'],
            'appointmentId': contact_response['body'].get('appointmentId'),
            'googleEventLink': contact_response['body'].get('googleEventLink'),
        }
        report['cases'].append({
            'name': 'frontend_submit_and_contact_api',
            'status': 'pass',
            'details': 'Selenium submitted /contact and captured a successful /api/contact response.',
        })

        verify_slot_busy(slot)
        report['cases'].append({
            'name': 'calendar_slot_busy_after_submit',
            'status': 'pass',
            'details': 'The same slot is no longer available after Calendar event creation.',
        })

        receipt = wait_for_gmail_receipt(marker, artifact_dir)
        report['gmail_receipt'] = receipt
        report['cases'].append({
            'name': 'gmail_receipt',
            'status': 'pass',
            'details': f'Found marker {marker} in {EXPECTED_GMAIL_RECIPIENT}.',
        })

        report['status'] = 'pass'
        print('Production appointment Calendar and Gmail E2E completed successfully.')
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

        write_json(artifact_dir / 'result.json', report)
        write_report_md(artifact_dir, report)


if __name__ == '__main__':
    main()
