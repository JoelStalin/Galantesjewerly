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

OUTPUT_DIR = CURRENT_DIR / 'tests' / 'e2e' / 'artifacts' / f"account-navbar-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def by_test_id(value: str) -> tuple[str, str]:
    return By.CSS_SELECTOR, f"[data-testid='{value}']"


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


def clear_customer_session(driver) -> None:
    driver.get(f'{BASE_URL}/')
    driver.delete_all_cookies()


def assert_account_navbar_layout(driver, wait: WebDriverWait, path: str) -> dict:
    driver.get(f'{BASE_URL}{path}')
    wait.until(
        lambda current: '/auth/login' not in current.current_url
        and urlparse(current.current_url).path.startswith(path)
    )
    navbar = wait.until(EC.presence_of_element_located(by_test_id('site-navbar')))
    heading = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'main h1')))

    metrics = driver.execute_script(
        """
        const navbar = arguments[0];
        const heading = arguments[1];
        const navbarRect = navbar.getBoundingClientRect();
        const headingRect = heading.getBoundingClientRect();
        const styles = window.getComputedStyle(navbar);
        return {
          position: styles.position,
          top: styles.top,
          navbarBottom: navbarRect.bottom,
          headingTop: headingRect.top,
          headingText: heading.textContent.trim(),
        };
        """,
        navbar,
        heading,
    )

    if metrics['position'] != 'sticky':
        raise AssertionError(f"Navbar position for {path} is {metrics['position']!r}, expected 'sticky'.")
    if float(metrics['headingTop']) < float(metrics['navbarBottom']) - 1:
        raise AssertionError(
            f"Navbar overlaps page content on {path}. headingTop={metrics['headingTop']} navbarBottom={metrics['navbarBottom']}"
        )
    return metrics


def main() -> None:
    stamp = datetime.now().strftime('%Y%m%d%H%M%S')
    username = f'qanav{stamp}'
    email = f'qa.account.navbar.{stamp}@example.com'
    password = f'GalantesQA!{stamp}'
    full_name = f'QA Account Navbar {stamp}'

    report = {
        'status': 'in_progress',
        'base_url': BASE_URL,
        'profile': PROFILE_NAME,
        'headless': HEADLESS,
        'artifacts': str(OUTPUT_DIR),
        'cases': [],
        'errors': [],
    }

    driver, profile_dir = get_profile_runtime_driver(PROFILE_NAME, headless=HEADLESS)
    if driver is None:
        report['status'] = 'blocked'
        report['errors'].append('Chrome profile is locked. Close Chrome manually and rerun.')
        (OUTPUT_DIR / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps(report, indent=2), flush=True)
        return

    report['profile_dir'] = str(profile_dir)

    try:
        wait = WebDriverWait(driver, 45)

        clear_customer_session(driver)
        driver.get(f'{BASE_URL}/auth/login?returnTo=/account/orders')
        wait.until(EC.presence_of_element_located((By.TAG_NAME, 'h1')))

        click_visible_button(driver, wait, 'Register')
        wait.until(lambda current: visible_input_for_label(current, 'Full name'))
        set_input(driver, wait, 'Full name', full_name)
        set_input(driver, wait, 'Username', username)
        set_input(driver, wait, 'Email', email)
        set_input(driver, wait, 'Password', password)
        set_input(driver, wait, 'Confirm password', password)
        click_visible_button(driver, wait, 'Create account')
        wait.until(lambda current: urlparse(current.current_url).path == '/account/orders')

        report['cases'].append({
            'name': 'customer_register',
            'status': 'pass',
            'evidence': [save_screenshot(driver, '01_after_register')],
        })

        for path in ('/account/orders', '/account/invoices', '/account/settings'):
            metrics = assert_account_navbar_layout(driver, wait, path)
            report['cases'].append({
                'name': f'navbar_sticky_{path}',
                'status': 'pass',
                'metrics': metrics,
                'evidence': [save_screenshot(driver, path.replace('/', '_').strip('_'))],
            })

        report['status'] = 'pass'
        print(json.dumps(report, indent=2), flush=True)
    except Exception as error:
        report['status'] = 'fail'
        report['errors'].append(f'{type(error).__name__}: {error}')
        try:
            save_screenshot(driver, '99_failure')
        except Exception:
            pass
        print(json.dumps(report, indent=2), flush=True)
        raise
    finally:
        (OUTPUT_DIR / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        time.sleep(2)
        driver.quit()


if __name__ == '__main__':
    main()
