from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta
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
CONTACT_URL = 'https://galantesjewelry.com/contact'
API_BASE = 'https://galantesjewelry.com'
PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Profile 9')
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', '')


def artifact_dir() -> Path:
  root = Path(__file__).resolve().parent.parent / 'tests' / 'e2e' / 'artifacts'
  target = root / f"admin-schedule-{time.strftime('%Y%m%d-%H%M%S')}"
  target.mkdir(parents=True, exist_ok=True)
  return target


def by_test_id(value: str) -> tuple[str, str]:
  return By.CSS_SELECTOR, f"[data-testid='{value}']"


def get_driver():
  driver, _ = get_profile_runtime_driver(PROFILE_NAME, headless=False)
  if driver is None:
    print('BLOCKED: Chrome esta abierto con Profile 9. Cierra Chrome manualmente y vuelve a ejecutar.', flush=True)
  return driver


def set_value(driver, wait: WebDriverWait, test_id: str, value: str) -> None:
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


def set_checkbox(driver, wait: WebDriverWait, test_id: str, checked: bool) -> None:
  element = wait.until(EC.presence_of_element_located(by_test_id(test_id)))
  driver.execute_script('arguments[0].scrollIntoView({ block: "center" });', element)
  if element.is_selected() != checked:
    element.click()


def fetch_json(url: str):
  request = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'GalantesAdminScheduleE2E/1.0'})
  with urllib.request.urlopen(request, timeout=45) as response:
    return response.status, json.loads(response.read().decode('utf-8'))


def fetch_admin_integrations(driver):
  result = driver.execute_async_script(
    """
    const done = arguments[0];
    fetch('/api/admin/integrations', { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        done({ status: response.status, body });
      })
      .catch((error) => done({ status: 0, error: String(error) }));
    """
  )
  if result.get('status') != 200:
    raise AssertionError(f'Could not read admin integrations: {result}')
  return result['body']


def wait_for_save_notice(driver, wait: WebDriverWait) -> None:
  wait.until(
    lambda current: 'Appointment settings saved.' in current.page_source
  )


def login_if_needed(driver, wait: WebDriverWait) -> None:
  driver.get(ADMIN_URL)
  wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))

  if '/admin/login' not in driver.current_url:
    wait.until(EC.presence_of_element_located(by_test_id('appointment-timezone')))
    return

  if not ADMIN_PASSWORD:
    raise RuntimeError('ADMIN_PASSWORD is missing for admin schedule verification.')

  username_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='username']")))
  password_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='password']")))
  username_input.clear()
  username_input.send_keys(ADMIN_USERNAME)
  password_input.clear()
  password_input.send_keys(ADMIN_PASSWORD)

  submit_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Unlock Panel']")))
  driver.execute_script('arguments[0].click();', submit_button)
  wait.until(lambda current: '/admin/login' not in current.current_url and '/admin/dashboard' in current.current_url)
  wait.until(EC.presence_of_element_located(by_test_id('appointment-timezone')))


def apply_schedule(driver, wait: WebDriverWait, config: dict) -> None:
  set_value(driver, wait, 'appointment-timezone', config['appointmentTimezone'])
  set_value(driver, wait, 'appointment-duration', str(config['appointmentDurationMinutes']))
  set_value(driver, wait, 'appointment-start-time', config['appointmentStartTime'])
  set_value(driver, wait, 'appointment-end-time', config['appointmentEndTime'])
  set_value(driver, wait, 'appointment-slot-interval', str(config['appointmentSlotIntervalMinutes']))

  selected = set(config['appointmentAvailableWeekdays'])
  for day in range(7):
    set_checkbox(driver, wait, f'appointment-weekday-{day}', day in selected)

  save_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[normalize-space()='Apply All Settings']")))
  driver.execute_script('arguments[0].scrollIntoView({ block: "center" });', save_button)
  driver.execute_script('arguments[0].click();', save_button)
  wait_for_save_notice(driver, wait)
  time.sleep(2)


def next_date_for_weekday(weekday: int, start_offset: int = 2) -> str:
  current = date.today() + timedelta(days=start_offset)
  while current.weekday() != ((weekday + 6) % 7):
    current += timedelta(days=1)
  return current.isoformat()


def next_disabled_date(enabled_days: list[int]) -> str | None:
  disabled = [day for day in range(7) if day not in enabled_days]
  if not disabled:
    return None
  return next_date_for_weekday(disabled[0])


def find_public_slot(enabled_days: list[int]) -> tuple[str, list[dict]]:
  for day in enabled_days:
    for offset in range(2, 28):
      candidate = date.today() + timedelta(days=offset)
      if candidate.weekday() != ((day + 6) % 7):
        continue
      status, body = fetch_json(f"{API_BASE}/api/contact/availability?{urllib.parse.urlencode({'appointmentDate': candidate.isoformat()})}")
      if status == 200 and body.get('availableSlots'):
        return candidate.isoformat(), body['availableSlots']
  raise AssertionError('No available public slot was found for the configured weekdays.')


def verify_public_schedule(driver, wait: WebDriverWait, expected_days: str, expected_window: str, disabled_date: str | None, enabled_date: str) -> dict:
  driver.get(CONTACT_URL)
  wait.until(EC.presence_of_element_located(by_test_id('contact-appointment-date')))
  wait.until(lambda current: expected_days in current.page_source and expected_window in current.page_source)

  disabled_message = None
  if disabled_date:
    set_value(driver, wait, 'contact-appointment-date', disabled_date)
    disabled_message = wait.until(EC.visibility_of_element_located(by_test_id('contact-availability-error'))).text
    if 'Appointments are not offered on the selected day' not in disabled_message:
      raise AssertionError(f'Unexpected disabled-day message: {disabled_message!r}')

  set_value(driver, wait, 'contact-appointment-date', enabled_date)
  wait.until(lambda current: len(current.find_elements(By.CSS_SELECTOR, "[data-testid^='contact-slot-']")) > 0)
  slots = [
    element.text.strip()
    for element in driver.find_elements(By.CSS_SELECTOR, "[data-testid^='contact-slot-']")
    if element.text.strip()
  ]
  if not slots:
    raise AssertionError('No slot buttons were rendered after selecting an enabled day.')

  return {
    'disabledDate': disabled_date,
    'disabledMessage': disabled_message,
    'enabledDate': enabled_date,
    'renderedSlots': slots[:6],
  }


def main() -> None:
  report = {
    'status': 'in_progress',
    'profile': PROFILE_NAME,
    'cases': [],
    'errors': [],
  }
  target_dir = artifact_dir()
  driver = get_driver()
  if driver is None:
    report['status'] = 'blocked'
    (target_dir / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2), flush=True)
    return

  original_config = None
  try:
    wait = WebDriverWait(driver, 45)
    login_if_needed(driver, wait)
    payload = fetch_admin_integrations(driver)
    appointment_configs = payload.get('appointmentConfigs') or []
    original_config = next((item for item in appointment_configs if item.get('environment') == 'production'), None)
    if not original_config:
      raise AssertionError('Production appointment config was not found in admin integrations.')

    temp_config = {
      'appointmentTimezone': original_config['appointmentTimezone'],
      'appointmentDurationMinutes': 60,
      'appointmentStartTime': '10:00',
      'appointmentEndTime': '16:00',
      'appointmentSlotIntervalMinutes': 60,
      'appointmentAvailableWeekdays': [1, 3, 5],
    }

    apply_schedule(driver, wait, temp_config)
    report['cases'].append({
      'name': 'admin_schedule_save',
      'status': 'pass',
      'config': temp_config,
    })

    enabled_date, available_slots = find_public_slot(temp_config['appointmentAvailableWeekdays'])
    public_result = verify_public_schedule(
      driver,
      wait,
      'Appointments are offered on Monday, Wednesday, Friday.',
      '10:00 to 16:00',
      next_disabled_date(temp_config['appointmentAvailableWeekdays']),
      enabled_date,
    )
    public_result['availableSlotsFromApi'] = available_slots[:6]
    report['cases'].append({
      'name': 'public_schedule_reflects_admin_config',
      'status': 'pass',
      **public_result,
    })

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
    if original_config:
      try:
        driver.get(ADMIN_URL)
        wait = WebDriverWait(driver, 45)
        wait.until(EC.presence_of_element_located(by_test_id('appointment-timezone')))
        apply_schedule(driver, wait, {
          'appointmentTimezone': original_config['appointmentTimezone'],
          'appointmentDurationMinutes': original_config['appointmentDurationMinutes'],
          'appointmentStartTime': original_config['appointmentStartTime'],
          'appointmentEndTime': original_config['appointmentEndTime'],
          'appointmentSlotIntervalMinutes': original_config['appointmentSlotIntervalMinutes'],
          'appointmentAvailableWeekdays': original_config['appointmentAvailableWeekdays'],
        })
        report['cases'].append({
          'name': 'admin_schedule_restore',
          'status': 'pass',
        })
      except Exception as restore_error:
        report['status'] = 'fail'
        report['errors'].append(f'restore_failed: {type(restore_error).__name__}: {restore_error}')
    (target_dir / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2), flush=True)
    driver.quit()


if __name__ == '__main__':
  main()
