from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from profile_runtime import get_driver

BASE_URL = os.getenv('E2E_BASE_URL', 'http://localhost:3000').rstrip('/')
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
        print("Failed to start driver")
        return

    wait = WebDriverWait(driver, 20)
    try:
        # 1. Setup Cart
        cart = [{
            'id': '24',
            'slug': 'the-islamorada-solitaire',
            'name': 'The Islamorada Solitaire',
            'price': 1250,
            'quantity': 1,
            'image_url': '/api/products/image?id=24',
        }]

        driver.get(BASE_URL)
        driver.execute_script(
            "localStorage.setItem('galantes_cart', arguments[0]);",
            json.dumps(cart),
        )
        
        # 2. Go to Checkout
        print("\nNavigating to checkout...")
        driver.get(f'{BASE_URL}/checkout')

        wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(., 'Checkout')]")))
        check('Checkout page loads', '/checkout' in driver.current_url)

        # 3. Fill Address to trigger shipping rates
        print("Filling address details...")
        driver.find_element(By.XPATH, "//input[@placeholder='Full Name']").send_keys('John Doe')
        driver.find_element(By.XPATH, "//input[@placeholder='Email Address']").send_keys('john@example.com')
        driver.find_element(By.XPATH, "//input[@placeholder='Street Address']").send_keys('82681 Overseas Highway')
        driver.find_element(By.XPATH, "//input[@placeholder='City']").send_keys('Islamorada')
        driver.find_element(By.XPATH, "//input[@placeholder='Zip Code']").send_keys('33036')
        driver.find_element(By.XPATH, "//input[@placeholder='State']").send_keys('FL')
        
        # 4. Verify Shipping Rates
        print("Waiting for shipping rates...")
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="shipping-rate-pickup"]')))
        
        rates = driver.find_elements(By.CSS_SELECTOR, '[data-testid^="shipping-rate-"]')
        carriers = [r.get_attribute('data-testid').replace('shipping-rate-', '') for r in rates]
        
        check('USPS rate present', 'usps' in carriers)
        check('UPS rate present', 'ups' in carriers)
        check('FedEx rate present', 'fedex' in carriers)
        check('Pick-up rate present', 'pickup' in carriers)

        # 5. Verify Pick-up is FREE
        pickup_rate = driver.find_element(By.CSS_SELECTOR, '[data-testid="shipping-rate-pickup"]')
        pickup_price = pickup_rate.find_element(By.XPATH, ".//p[contains(text(), 'FREE')]")
        check('Pick-up is FREE', pickup_price is not None)

        # 6. Select Pick-up and check for appointment link
        print("Selecting Pick-up...")
        driver.execute_script("arguments[0].click();", pickup_rate)
        
        appointment_link = wait.until(EC.presence_of_element_located((By.XPATH, "//a[contains(text(), 'Schedule Collection Appointment')]")))
        check('Appointment link appears for pick-up', appointment_link.is_displayed())
        check('Appointment link target is correct', '/appointments?reason=pickup' in appointment_link.get_attribute('href'))

        # 7. Verify Cost-based selection (Select FedEx)
        print("Selecting FedEx...")
        fedex_rate = driver.find_element(By.CSS_SELECTOR, '[data-testid="shipping-rate-fedex"]')
        driver.execute_script("arguments[0].click();", fedex_rate)
        
        wait.until(lambda d: d.find_element(By.CSS_SELECTOR, '[data-testid="checkout-shipping-total"]').text != 'FREE')
        shipping_total = driver.find_element(By.CSS_SELECTOR, '[data-testid="checkout-shipping-total"]').text
        check('Shipping total updated for FedEx', '$' in shipping_total)
        
        total_text = driver.find_element(By.CSS_SELECTOR, '[data-testid="checkout-total"]').text
        check('Total includes FedEx shipping cost', total_text != '$1,250.00')

        # 8. Test redirection after payment (MOCKING SUCCESS PAGE)
        print("\nTesting redirection on success page (Debug Mode)...")
        driver.get(f'{BASE_URL}/checkout/success?debug=true&carrier=pickup')
        
        print("Waiting for success content heading...")
        # Wait for the heading that appears after loading
        wait.until(EC.presence_of_element_located((By.XPATH, "//h2[contains(text(), 'Finalize Your Delivery')]")))
        check('Success page appointment section visible', True)

        appointment_btn = driver.find_element(By.XPATH, "//a[contains(text(), 'Schedule Appointment Now')]")
        check('Appointment button present on success page', appointment_btn.is_displayed())

        href = appointment_btn.get_attribute('href')
        check('Appointment button link contains orderId', 'orderId=9999' in href)
        check('Appointment button link contains carrier', 'carrier=pickup' in href)

        print("Clicking appointment button...")
        driver.execute_script("arguments[0].click();", appointment_btn)

        wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(., 'Private Consultations')]")))
        check('Redirected to appointments page (Contact)', True)

        print("\nVerifying non-pickup success page...")
        driver.get(f'{BASE_URL}/checkout/success?debug=true&carrier=fedex')
        wait.until(EC.presence_of_element_located((By.XPATH, "//h2[contains(text(), 'Finalize Your Delivery')]")))
        page_source = driver.page_source
        check('Non-pickup message displayed', 'coordinate your secure delivery' in page_source)


    except Exception as e:
        print(f"ERROR: {e}")
        print("Current URL:", driver.current_url)
        try:
            logs = driver.get_log('browser')
            for log in logs:
                print(f"BROWSER LOG: {log}")
        except:
            pass
        try:
            print("Page Source Snippet:", driver.page_source[:2000])
        except:
            pass
        driver.save_screenshot('shipping_test_error.png')
    finally:
        driver.quit()

if __name__ == '__main__':
    main()
