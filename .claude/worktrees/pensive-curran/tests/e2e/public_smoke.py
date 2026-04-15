from __future__ import annotations

import os
import sys
from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from profile_runtime import get_driver

BASE_URL = os.getenv('E2E_BASE_URL', 'http://127.0.0.1:3000').rstrip('/')
PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Default')
HEADLESS = os.getenv('SELENIUM_HEADLESS', '0') == '1'


def main() -> None:
    driver, profile_dir = get_driver(PROFILE_NAME, headless=HEADLESS)
    if driver is None:
        return

    print(f'Profile path: {profile_dir}')
    try:
        wait = WebDriverWait(driver, 20)

        driver.get(f'{BASE_URL}/')
        wait.until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "[data-testid^='featured-public-card-']"),
            ),
        )
        print('Public home responded with rendered featured cards.')

        driver.get(f'{BASE_URL}/admin/login')
        wait.until(lambda current: '/admin/login' in current.current_url or '/admin/dashboard' in current.current_url)
        if '/admin/dashboard' in driver.current_url:
            print('Admin session already active in the cloned profile.')
        else:
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[data-testid='login-submit']")))
            print('Admin login responded with a stable form.')
    finally:
        driver.quit()


if __name__ == '__main__':
    main()
