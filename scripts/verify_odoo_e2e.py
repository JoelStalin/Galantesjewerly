from __future__ import annotations
import sys
import json
import time
from pathlib import Path
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

CURRENT_DIR = Path(__file__).resolve().parent.parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from tests.e2e.profile_runtime import get_driver

BASE_URL = 'https://galantesjewelry.com'

def by_test_id(value: str):
    return By.CSS_SELECTOR, f"[data-testid='{value}']"

def set_text(driver, wait, test_id, value):
    element = wait.until(EC.presence_of_element_located(by_test_id(test_id)))
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', element)
    element.clear()
    element.send_keys(value)

def set_native_value(driver, wait, test_id, value):
    element = wait.until(EC.presence_of_element_located(by_test_id(test_id)))
    driver.execute_script(
        "const e = arguments[0]; e.scrollIntoView({block: 'center'}); e.value = arguments[1]; "
        "e.dispatchEvent(new Event('input', {bubbles: true})); "
        "e.dispatchEvent(new Event('change', {bubbles: true}));",
        element, value
    )

def install_fetch_recorder(driver):
    driver.execute_script(
        """
        window.__galantesContactResponses = [];
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            try {
                const target = args[0];
                const url = typeof target === 'string' ? target : (target && target.url) || '';
                if (String(url).includes('/api/contact') || String(url).includes('/api/appointments') || String(url).includes('/api/v1/appointments')) {
                    const cloned = response.clone();
                    const body = await cloned.text();
                    window.__galantesContactResponses.push({ status: response.status, body, url });
                }
            } catch (e) {}
            return response;
        };
        """
    )

def read_responses(driver):
    responses = driver.execute_script('return window.__galantesContactResponses || [];')
    valid = [r for r in responses if 'availability' not in r.get('url', '')]
    if not valid:
        return None
    latest = valid[-1]
    body = latest.get('body') or ''
    try:
        payload = json.loads(body)
    except:
        payload = {'raw': body}
    return {'status': latest.get('status'), 'body': payload}

def main():
    driver, _ = get_driver('Default', headless=False)
    if driver is None:
        print("BLOCKED: Chrome profile is locked.")
        return

    try:
        wait = WebDriverWait(driver, 45)
        print(f"Loading {BASE_URL}/contact...")
        driver.get(f'{BASE_URL}/contact')
        wait.until(EC.presence_of_element_located(by_test_id('contact-name')))
        
        install_fetch_recorder(driver)
        print("Filling out appointment form...")
        set_text(driver, wait, 'contact-name', 'Odoo Live Verification Test')
        set_text(driver, wait, 'contact-email', 'ceo@galantesjewelry.com')
        set_text(driver, wait, 'contact-phone', '555-000-ODOO')
        
        Select(wait.until(EC.presence_of_element_located(by_test_id('contact-inquiry-type')))).select_by_visible_text('General Inquiry')
        
        # We assume 1 month from now to avoid conflicts
        set_native_value(driver, wait, 'contact-appointment-date', '2026-12-15')
        set_native_value(driver, wait, 'contact-appointment-time', '15:00')
        set_text(driver, wait, 'contact-message', 'Automated E2E confirming real-time Odoo synchronization. Please ignore.')
        
        submit_button = wait.until(EC.element_to_be_clickable(by_test_id('contact-submit')))
        driver.execute_script('arguments[0].scrollIntoView({block: "center"});', submit_button)
        print("Submitting the appointment...")
        submit_button.click()
        
        success = wait.until(EC.presence_of_element_located(by_test_id('contact-success')))
        wait.until(lambda _: 'request received' in success.text.lower() or 'appointment' in success.text.lower())
        
        print("Form submitted successfully. Fetching API response to verify Odoo ID...")
        response = wait.until(lambda cur: read_responses(cur))
        
        body = response.get('body', {})
        if response['status'] == 201 or response['status'] == 200:
            odoo_id = body.get('odooAppointmentId')
            if odoo_id:
                print(f"✅ EXITO: La cita se sincronizó correctamente con Odoo. Odoo Appointment ID: {odoo_id}")
            else:
                print(f"⚠️ ADVERTENCIA: La cita se creó pero NO se regresó 'odooAppointmentId'. Respuesta cruda: {body}")
        else:
            print(f"❌ FALLO: La petición API devolvió HTTP {response['status']}. Body: {body}")
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
    finally:
        time.sleep(5)
        driver.quit()

if __name__ == '__main__':
    main()
