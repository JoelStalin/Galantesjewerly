from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

E2E_DIR = Path(__file__).resolve().parent.parent / 'tests' / 'e2e'
if str(E2E_DIR) not in sys.path:
    sys.path.insert(0, str(E2E_DIR))

from profile_runtime import get_driver as get_profile_runtime_driver  # noqa: E402

BASE_URL = os.getenv('E2E_BASE_URL', 'https://galantesjewelry.com').rstrip('/')
PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Profile 9')
HEADLESS = os.getenv('SELENIUM_HEADLESS', '0') == '1'
APPOINTMENT_TIMEZONE = os.getenv('E2E_APPOINTMENT_TIMEZONE', 'America/New_York')


def artifact_dir() -> Path:
    root = Path(__file__).resolve().parent.parent / 'tests' / 'e2e' / 'artifacts'
    target = root / f"prod-calendar-only-{time.strftime('%Y%m%d-%H%M%S')}"
    target.mkdir(parents=True, exist_ok=True)
    return target


def by_test_id(value: str) -> tuple[str, str]:
    return By.CSS_SELECTOR, f"[data-testid='{value}']"


def request_json(url: str) -> tuple[int, dict]:
    request = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'GalantesProdCalendarOnly/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.status, json.loads(response.read().decode('utf-8'))


def check_availability(appointment_date: str, appointment_time: str | None = None) -> tuple[int, dict]:
    params = {'appointmentDate': appointment_date}
    if appointment_time:
      params['appointmentTime'] = appointment_time
    return request_json(f"{BASE_URL}/api/contact/availability?{urllib.parse.urlencode(params)}")


def slot_candidates() -> list[str]:
    try:
        timezone = ZoneInfo(APPOINTMENT_TIMEZONE)
        now = datetime.now(timezone)
    except Exception:
        now = datetime.now()

    slots: list[str] = []
    for day_offset in range(2, 18):
        current_date = (now + timedelta(days=day_offset)).date()
        slots.append(current_date.isoformat())
    return slots


def find_available_slot() -> dict:
    first_error = ''
    for appointment_date in slot_candidates():
        status, body = check_availability(appointment_date)
        if status != 200:
            first_error = first_error or json.dumps(body)
            continue
        available_slots = body.get('availableSlots') or []
        if available_slots:
            return {
                'appointmentDate': appointment_date,
                'appointmentTime': available_slots[0]['time'],
                'timezone': body.get('timezone') or APPOINTMENT_TIMEZONE,
                'availableSlots': available_slots,
                'conflictBufferMinutes': body.get('conflictBufferMinutes'),
            }
    raise AssertionError(f'No available appointment slot found. First API error: {first_error}')


def save_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


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
                window.__galantesContactResponses.push({ url: String(url), status: response.status, body });
              }
            } catch (error) {}
            return response;
          };
        }
        """,
    )


def read_contact_response(driver) -> dict | None:
    responses = driver.execute_script('return window.__galantesContactResponses || [];') or []
    filtered = [
        item for item in responses
        if '/api/contact' in str(item.get('url')) and '/availability' not in str(item.get('url'))
    ]
    if not filtered:
        return None
    latest = filtered[-1]
    return {
        'status': latest.get('status'),
        'body': json.loads(latest.get('body') or '{}'),
    }


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
        const prototype = Object.getPrototypeOf(element);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(element, value);
        } else {
          element.value = value;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        """,
        element,
        value,
    )


def click_element(driver, element) -> None:
    driver.execute_script(
        """
        arguments[0].scrollIntoView({ block: 'center', inline: 'center' });
        arguments[0].click();
        """,
        element,
    )


def get_driver():
    driver, _ = get_profile_runtime_driver(PROFILE_NAME, headless=HEADLESS)
    if driver is None:
        print('BLOCKED: Chrome esta abierto con Profile 9. Cierra Chrome manualmente y vuelve a ejecutar.', flush=True)
    return driver


def main() -> None:
    artifacts = artifact_dir()
    marker = 'CALENDAR-E2E-' + datetime.now().strftime('%Y%m%d%H%M%S')
    report: dict = {
        'status': 'in_progress',
        'profile': PROFILE_NAME,
        'baseUrl': BASE_URL,
        'marker': marker,
        'cases': [],
        'errors': [],
    }

    driver = get_driver()
    if driver is None:
        report['status'] = 'blocked'
        save_json(artifacts / 'result.json', report)
        print(json.dumps(report, indent=2), flush=True)
        return

    try:
        health_status, health_body = request_json(f'{BASE_URL}/api/health')
        if health_status != 200:
            raise AssertionError(f'Health check failed: {health_status} {health_body}')
        report['cases'].append({'name': 'health_check', 'status': 'pass'})

        slot = find_available_slot()
        if slot.get('conflictBufferMinutes') != 5:
            raise AssertionError(f"Expected conflictBufferMinutes=5, got {slot.get('conflictBufferMinutes')}")
        report['selectedSlot'] = slot
        report['cases'].append({
            'name': 'available_slot_search',
            'status': 'pass',
            'details': f"{slot['appointmentDate']} {slot['appointmentTime']}",
        })

        wait = WebDriverWait(driver, 45)
        driver.get(f'{BASE_URL}/contact')
        wait.until(EC.presence_of_element_located(by_test_id('contact-name')))
        install_fetch_recorder(driver)

        buffer_caption = wait.until(
            EC.presence_of_element_located(
                (
                    By.XPATH,
                    "//*[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '5-minute protection window')]",
                )
            )
        )
        if '5-minute protection window' not in buffer_caption.text.lower():
            raise AssertionError('The 5-minute protection caption did not render on the contact form.')
        report['cases'].append({'name': 'buffer_caption_visible', 'status': 'pass'})

        set_text(driver, wait, 'contact-name', f'Galantes Calendar {marker}')
        set_text(driver, wait, 'contact-email', f'{marker.lower()}@example.com')
        set_text(driver, wait, 'contact-phone', '+13055550123')
        Select(wait.until(EC.presence_of_element_located(by_test_id('contact-inquiry-type')))).select_by_visible_text('General Inquiry')
        set_native_value(driver, wait, 'contact-appointment-date', slot['appointmentDate'])
        wait.until(lambda current: len(current.find_elements(By.CSS_SELECTOR, "[data-testid^='contact-slot-']")) > 0)
        slot_buttons = driver.find_elements(By.CSS_SELECTOR, "[data-testid^='contact-slot-']")
        if not slot_buttons:
            raise AssertionError('The frontend did not render any available slot buttons.')
        slot_button = slot_buttons[0]
        click_element(driver, slot_button)
        selected_time = wait.until(EC.presence_of_element_located(by_test_id('contact-appointment-time'))).get_attribute('value')
        if not selected_time:
            raise AssertionError('The frontend did not persist the selected appointment time.')
        slot['appointmentTime'] = selected_time
        set_text(driver, wait, 'contact-message', f'{marker} - Selenium production calendar verification.')

        submit_button = wait.until(EC.element_to_be_clickable(by_test_id('contact-submit')))
        click_element(driver, submit_button)

        success = wait.until(EC.presence_of_element_located(by_test_id('contact-success')))
        wait.until(lambda _: 'request' in success.text.lower() or 'appointment' in success.text.lower())

        response = wait.until(lambda current: read_contact_response(current))
        if response['status'] != 200 or not response['body'].get('success'):
            raise AssertionError(f'Contact submit failed: {response}')
        if not response['body'].get('appointmentId'):
            raise AssertionError('appointmentId was missing from /api/contact response.')
        if not response['body'].get('googleEventLink'):
            raise AssertionError('googleEventLink was missing from /api/contact response.')

        report['contactResponse'] = response
        report['cases'].append({'name': 'frontend_submit', 'status': 'pass'})

        status_after, body_after = check_availability(slot['appointmentDate'], slot['appointmentTime'])
        if status_after != 200 or body_after.get('available') is not False:
            raise AssertionError(f'Slot still appears free after submit: {body_after}')
        report['cases'].append({'name': 'slot_is_busy_after_submit', 'status': 'pass'})

        report['status'] = 'pass'
    except TimeoutException as error:
        report['status'] = 'fail'
        report['errors'].append(f'TimeoutException: {error}')
        raise
    except Exception as error:
        report['status'] = 'fail'
        report['errors'].append(f'{type(error).__name__}: {error}')
        raise
    finally:
        save_json(artifacts / 'result.json', report)
        print(json.dumps(report, indent=2), flush=True)
        driver.quit()


if __name__ == '__main__':
    main()
