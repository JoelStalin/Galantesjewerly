from __future__ import annotations

import json
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
PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Profile 9')
HEADLESS = os.getenv('SELENIUM_HEADLESS', '0') == '1'

PASS = 'PASS'
FAIL = 'FAIL'


def check(label: str, condition: bool, detail: str = '') -> bool:
    status = PASS if condition else FAIL
    print(f'{status}  {label}' + (f' - {detail}' if detail else ''))
    return condition


def main() -> None:
    driver, _ = get_driver(PROFILE_NAME, headless=HEADLESS)
    if driver is None:
        return

    wait = WebDriverWait(driver, 20)
    try:
        cart = [{
            'id': '24',
            'slug': 'the-islamorada-solitaire',
            'name': 'The Islamorada Solitaire',
            'price': 1250,
            'quantity': 2,
            'image_url': '/api/products/image?id=24',
        }]

        driver.get(BASE_URL)
        driver.execute_script(
            "localStorage.setItem('galantes_cart', arguments[0]);",
            json.dumps(cart),
        )
        driver.get(f'{BASE_URL}/checkout')

        wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(., 'Checkout')]")))
        check('Checkout page loads', '/checkout' in driver.current_url, driver.current_url)

        driver.find_element(By.XPATH, "//input[@placeholder='Full Name']").send_keys('Ana Buyer')
        driver.find_element(By.XPATH, "//input[@placeholder='Email Address']").send_keys('ana@example.com')
        driver.find_element(By.XPATH, "//input[@placeholder='Street Address']").send_keys('123 Ocean Dr')
        driver.find_element(By.XPATH, "//input[@placeholder='City']").send_keys('Miami')
        driver.find_element(By.XPATH, "//input[@placeholder='Zip Code']").send_keys('33139')
        driver.find_element(By.XPATH, "//input[@placeholder='State']").send_keys('FL')
        driver.find_element(By.XPATH, "//input[@placeholder='Country']").send_keys('United States')

        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="shipping-rate-ups"]')))
        check('Shipping rates rendered', len(driver.find_elements(By.CSS_SELECTOR, '[data-testid^="shipping-rate-"]')) >= 2)

        shipping_total_el = driver.find_element(By.CSS_SELECTOR, '[data-testid="checkout-shipping-total"]')
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '[data-testid="checkout-shipping-total"]').text != 'Choose at checkout')
        before_total = shipping_total_el.text
        ups_rate = driver.find_element(By.CSS_SELECTOR, '[data-testid="shipping-rate-ups"]')
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", ups_rate)
        driver.execute_script("arguments[0].click();", ups_rate)
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '[data-testid="checkout-shipping-total"]').text != before_total)
        updated_shipping_total = driver.find_element(By.CSS_SELECTOR, '[data-testid="checkout-shipping-total"]').text
        check(
            'UPS shipping selected',
            'UPS Next Day Air (Secure)' in driver.page_source,
            updated_shipping_total,
        )
        check(
            'Shipping total updates',
            updated_shipping_total not in ('', 'Choose at checkout') and updated_shipping_total != before_total,
            updated_shipping_total,
        )

        continue_button = driver.find_element(By.CSS_SELECTOR, '[data-testid="checkout-continue"]')
        check('Continue button enabled', continue_button.is_enabled())

        total_text = driver.find_element(By.CSS_SELECTOR, '[data-testid="checkout-total"]').text
        total_value = float(total_text.replace('$', '').replace(',', '').strip())
        check('Estimated total includes shipping', total_value > 2500, total_text)
    finally:
        driver.quit()


if __name__ == '__main__':
    main()
