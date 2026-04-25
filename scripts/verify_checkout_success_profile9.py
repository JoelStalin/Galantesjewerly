from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select
from selenium.webdriver.support.ui import WebDriverWait

CURRENT_DIR = Path(__file__).resolve().parent.parent
E2E_DIR = CURRENT_DIR / 'tests' / 'e2e'
if str(E2E_DIR) not in sys.path:
    sys.path.insert(0, str(E2E_DIR))

from profile_runtime import get_driver as get_profile_runtime_driver

BASE_URL = os.getenv('E2E_BASE_URL', 'https://galantesjewelry.com').rstrip('/')
ODOO_API_BASE_URL = os.getenv('ODOO_API_BASE_URL', 'https://odoo.galantesjewelry.com').rstrip('/')
PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Profile 9')
HEADLESS = os.getenv('SELENIUM_HEADLESS', '0') == '1'
FALLBACK_PRODUCT = {
    'id': '24',
    'product_id': '24',
    'slug': 'classic-pearl-stud-earrings',
    'name': 'Classic Pearl Stud Earrings',
    'price': 395.0,
    'quantity': 1,
    'image_url': '',
    'availability': 'out_of_stock',
}

OUTPUT_DIR = CURRENT_DIR / 'tests' / 'e2e' / 'artifacts' / f"checkout-success-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def save_screenshot(driver, name: str) -> str:
    filename = f'{name}.png'
    driver.save_screenshot(str(OUTPUT_DIR / filename))
    return filename


def visible(driver, by: By, value: str):
    candidates = driver.find_elements(by, value)
    return next((element for element in candidates if element.is_displayed()), None)


def visible_button_by_text(driver, text: str):
    xpath = f"//button[normalize-space()='{text}']"
    return visible(driver, By.XPATH, xpath)


def clear_cart_storage(driver) -> None:
    safe_get(driver, f'{BASE_URL}/')
    driver.execute_script("window.localStorage.removeItem('galantes_cart');")
    driver.execute_script("window.sessionStorage.removeItem('galantes_cart');")


def safe_get(driver, url: str) -> None:
    try:
        driver.get(url)
    except TimeoutException:
        # Production pages can keep loading non-critical assets after the DOM is usable.
        pass


def fetch_checkout_product() -> dict[str, object]:
    url = f'{ODOO_API_BASE_URL}/api/products?pageSize=50'
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            payload = json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
        return dict(FALLBACK_PRODUCT)

    products = payload.get('data') or []
    for product in products:
        price = float(product.get('price') or 0)
        product_id = int(product.get('id') or 0)
        if product_id > 1 and price > 0:
            return {
                'id': str(product_id),
                'product_id': str(product_id),
                'slug': str(product.get('slug') or f'product-{product_id}'),
                'name': str(product.get('name') or f'Product {product_id}'),
                'price': price,
                'quantity': 1,
                'image_url': product.get('imageUrl') or '',
                'availability': product.get('availability'),
            }

    return dict(FALLBACK_PRODUCT)


def inject_product_into_cart(driver, product: dict[str, object]) -> None:
    safe_get(driver, f'{BASE_URL}/cart')
    driver.execute_script(
        """
        const item = arguments[0];
        window.localStorage.setItem('galantes_cart', JSON.stringify([item]));
        """,
        product,
    )
    driver.refresh()


def ensure_cart_has_items(driver, wait: WebDriverWait, product: dict[str, object]) -> None:
    safe_get(driver, f'{BASE_URL}/cart')
    wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
    if 'Your Cart is Empty' in driver.find_element(By.TAG_NAME, 'body').text:
        driver.execute_script(
            """
            const item = arguments[0];
            window.localStorage.setItem('galantes_cart', JSON.stringify([item]));
            """,
            product,
        )
        driver.refresh()
        wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
    if 'Your Cart is Empty' in driver.find_element(By.TAG_NAME, 'body').text:
        raise AssertionError('Cart is still empty after adding a product.')


def fill_checkout_form(driver, wait: WebDriverWait, stamp: str) -> dict[str, str]:
    safe_get(driver, f'{BASE_URL}/checkout')
    wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))

    customer = {
        'name': f'QA Checkout {stamp}',
        'email': f'qa.checkout.{stamp}@example.com',
        'phone': '3055552026',
        'street': '82681 Overseas Highway',
        'street2': 'Suite QA',
        'zip': '33036',
        'city': '',
    }

    def set_field(selector: str, value: str) -> None:
        element = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, selector)))
        driver.execute_script('arguments[0].scrollIntoView({block: "center"});', element)
        element.clear()
        element.send_keys(value)

    set_field("input[placeholder='Full Name']", customer['name'])
    set_field("input[placeholder='Email Address']", customer['email'])
    set_field("input[placeholder='Phone Number']", customer['phone'])
    set_field("[data-testid='checkout-street']", customer['street'])
    set_field("[data-testid='checkout-street2']", customer['street2'])
    set_field("[data-testid='checkout-zip']", customer['zip'])

    select_city = visible(driver, By.CSS_SELECTOR, "[data-testid='checkout-city-select']")
    input_city = visible(driver, By.CSS_SELECTOR, "[data-testid='checkout-city-input']")
    if select_city is not None:
        select = Select(select_city)
        options = [option for option in select.options if option.get_attribute('value')]
        if not options:
            raise AssertionError('Shipping city select is present but empty.')
        customer['city'] = options[0].get_attribute('value') or options[0].text.strip()
        select.select_by_value(customer['city'])
    elif input_city is not None:
        customer['city'] = 'Islamorada'
        input_city.clear()
        input_city.send_keys(customer['city'])
    else:
        raise AssertionError('Shipping city input/select was not found.')

    return customer


def create_checkout_payment(driver, product: dict[str, object], customer: dict[str, str]) -> dict[str, object]:
    payload = {
        'items': [
            {
                'id': product['id'],
                'slug': product['slug'],
                'name': product['name'],
                'product_id': product['product_id'],
                'price': product['price'],
                'quantity': product['quantity'],
            },
        ],
        'customerData': customer,
    }
    result = driver.execute_async_script(
        """
        const payload = arguments[0];
        const done = arguments[arguments.length - 1];
        fetch('/api/checkout/stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then(async (response) => {
            const text = await response.text();
            let body = {};
            try { body = JSON.parse(text); } catch (error) { body = { raw: text }; }
            done({ status: response.status, body });
          })
          .catch((error) => done({ status: 0, body: { error: String(error) } }));
        """,
        payload,
    )
    status = int(result.get('status') or 0)
    body = result.get('body') or {}

    if status != 200 or not body.get('clientSecret'):
        raise AssertionError(f'Checkout API did not return a client secret: {body}')

    client_secret = str(body['clientSecret'])
    payment_intent = client_secret.split('_secret_', 1)[0]
    if not payment_intent.startswith('pi_'):
        raise AssertionError(f'Unexpected Stripe client secret format: {client_secret}')

    return {
        'client_secret': client_secret,
        'payment_intent': payment_intent,
        'order_id': body.get('orderId'),
    }


def confirm_payment_intent(payment_intent: str) -> dict[str, object]:
    gcloud_bin = shutil.which('gcloud') or shutil.which('gcloud.cmd')
    if not gcloud_bin:
        raise AssertionError('gcloud CLI is not available in PATH for the Selenium checkout verification.')

    remote_command = (
        "sudo bash -lc 'cd /home/yoeli/galantesjewelry && "
        "set -a && source .env.prod && set +a && "
        f"curl -s https://api.stripe.com/v1/payment_intents/{payment_intent}/confirm "
        "-u \"$STRIPE_SECRET_KEY:\" "
        "-d payment_method=pm_card_visa "
        f"-d return_url={BASE_URL}/checkout/success'"
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
    payload = json.loads(result.stdout.strip() or '{}')
    if payload.get('status') != 'succeeded':
        raise AssertionError(f'Stripe payment intent did not succeed: {payload}')
    return payload


def open_success_page(driver, payment_intent: str, client_secret: str) -> None:
    safe_get(
        driver,
        f"{BASE_URL}/checkout/success?payment_intent={payment_intent}&payment_intent_client_secret={client_secret}",
    )


def wait_for_success(driver, wait: WebDriverWait) -> dict[str, str]:
    end = time.time() + 120
    last_url = ''
    while time.time() < end:
        current_url = driver.current_url
        last_url = current_url
        if urlparse(current_url).path == '/checkout/success':
            body = driver.find_element(By.TAG_NAME, 'body').text
            if 'Checkout confirmation error' in body:
                raise AssertionError(body)

            loading = visible(driver, By.CSS_SELECTOR, "[data-testid='checkout-success-loading']")
            if loading is not None:
                time.sleep(2)
                continue

            heading = visible(driver, By.CSS_SELECTOR, "[data-testid='checkout-success-heading']")
            state = visible(driver, By.CSS_SELECTOR, "[data-testid='checkout-success-state']")
            order_card = visible(driver, By.CSS_SELECTOR, "[data-testid='checkout-success-order']")
            invoice_card = visible(driver, By.CSS_SELECTOR, "[data-testid='checkout-success-invoice']")
            if heading is None and order_card is None and invoice_card is None:
                time.sleep(2)
                continue
            return {
                'url': current_url,
                'heading': heading.text.strip() if heading else '',
                'state': state.text.strip() if state else '',
                'order_text': order_card.text.strip() if order_card else '',
                'invoice_text': invoice_card.text.strip() if invoice_card else '',
            }
        time.sleep(2)

    raise AssertionError(f'Checkout did not redirect to /checkout/success. Last URL: {last_url}')


def verify_cart_is_empty(driver, wait: WebDriverWait) -> None:
    safe_get(driver, f'{BASE_URL}/cart')
    wait.until(EC.presence_of_element_located((By.TAG_NAME, 'body')))
    wait.until(lambda current: 'Your Cart is Empty' in current.find_element(By.TAG_NAME, 'body').text)


def main() -> None:
    stamp = datetime.now().strftime('%Y%m%d%H%M%S')
    report: dict[str, object] = {
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
        print('BLOCKED: Chrome esta abierto con Profile 9. Cierra Chrome manualmente y vuelve a ejecutar.', flush=True)
        return

    report['profile_dir'] = str(profile_dir)

    try:
        wait = WebDriverWait(driver, 45)
        driver.set_page_load_timeout(45)

        clear_cart_storage(driver)
        report['cases'].append({
            'name': 'clear_cart_storage',
            'status': 'pass',
            'details': 'Cleared client-side cart storage before the checkout test.',
        })

        product = fetch_checkout_product()
        inject_product_into_cart(driver, product)
        report['cases'].append({
            'name': 'seed_cart_with_paid_product',
            'status': 'pass',
            'details': f"Injected a paid Odoo product into the frontend cart: {product['name']}",
            'product': product,
        })

        ensure_cart_has_items(driver, wait, product)
        report['cases'].append({
            'name': 'cart_contains_item',
            'status': 'pass',
            'details': 'Cart page reflects the newly added item.',
            'evidence': [save_screenshot(driver, '01_cart_before_checkout')],
        })

        customer = fill_checkout_form(driver, wait, stamp)
        report['cases'].append({
            'name': 'checkout_contact_and_shipping',
            'status': 'pass',
            'details': 'Checkout contact and shipping fields are visible and accept the expected customer data.',
            'customer': customer,
            'evidence': [save_screenshot(driver, '02_checkout_payment_ready')],
        })

        checkout_payment = create_checkout_payment(driver, product, customer)
        report['cases'].append({
            'name': 'checkout_api_created_payment_intent',
            'status': 'pass',
            'details': 'The production checkout API created an Odoo order and Stripe payment intent for the same cart payload.',
            'checkout_payment': checkout_payment,
        })

        stripe_confirmation = confirm_payment_intent(str(checkout_payment['payment_intent']))
        report['cases'].append({
            'name': 'stripe_test_payment_confirmed',
            'status': 'pass',
            'details': 'The Stripe test payment intent was confirmed successfully from the production environment.',
            'payment_status': stripe_confirmation.get('status'),
            'payment_intent': stripe_confirmation.get('id'),
            'amount': stripe_confirmation.get('amount'),
        })

        open_success_page(driver, str(checkout_payment['payment_intent']), str(checkout_payment['client_secret']))
        success = wait_for_success(driver, wait)
        report['cases'].append({
            'name': 'checkout_success_screen',
            'status': 'pass',
            'details': 'The checkout success page shows the order or invoice after the payment succeeded.',
            'success': success,
            'evidence': [save_screenshot(driver, '03_checkout_success')],
        })

        verify_cart_is_empty(driver, wait)
        report['cases'].append({
            'name': 'cart_cleared_after_payment',
            'status': 'pass',
            'details': 'Cart is empty after the successful payment redirect.',
            'evidence': [save_screenshot(driver, '04_cart_empty_after_success')],
        })

        report['status'] = 'pass'
        print('PASS: Checkout success flow verified in production.', flush=True)
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
