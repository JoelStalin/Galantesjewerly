from __future__ import annotations
import sys
import json
import time
import os
import traceback
from pathlib import Path
from datetime import datetime, timedelta
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import StaleElementReferenceException
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

CURRENT_DIR = Path(__file__).resolve().parent.parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))
E2E_DIR = CURRENT_DIR / "tests" / "e2e"
if str(E2E_DIR) not in sys.path:
    sys.path.insert(0, str(E2E_DIR))
from profile_runtime import get_driver as get_profile_runtime_driver

BASE_URL = 'https://galantesjewelry.com'


def get_driver(profile_cmd: str | None = None):
    selected_profile = profile_cmd or os.getenv("SELENIUM_PROFILE", "Profile 9")
    driver, _ = get_profile_runtime_driver(selected_profile, headless=False)
    return driver

def by_test_id(value: str):
    return By.CSS_SELECTOR, f"[data-testid='{value}']"

def set_text(driver, wait, test_id, value):
    for _ in range(3):
        try:
            element = wait.until(EC.presence_of_element_located(by_test_id(test_id)))
            driver.execute_script('arguments[0].scrollIntoView({block: "center"});', element)
            element.clear()
            element.send_keys(value)
            return
        except StaleElementReferenceException:
            time.sleep(0.3)
    raise

def set_native_value(driver, wait, test_id, value):
    for _ in range(3):
        try:
            element = wait.until(EC.presence_of_element_located(by_test_id(test_id)))
            driver.execute_script(
                """
                const element = arguments[0];
                const nextValue = arguments[1];
                const prototype = element.tagName === 'TEXTAREA'
                  ? window.HTMLTextAreaElement.prototype
                  : window.HTMLInputElement.prototype;
                const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
                const setter = descriptor && descriptor.set;
                element.scrollIntoView({ block: 'center' });
                if (setter) {
                  setter.call(element, nextValue);
                } else {
                  element.value = nextValue;
                }
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                """,
                element,
                value,
            )
            return
        except StaleElementReferenceException:
            time.sleep(0.3)
    raise

def click_element_safe(driver, element):
    driver.execute_script('arguments[0].scrollIntoView({block: "center"});', element)
    # Offset a bit up to avoid sticky headers intercepting clicks.
    driver.execute_script("window.scrollBy(0, -140);")
    try:
        ActionChains(driver).move_to_element(element).pause(0.1).click().perform()
        return
    except Exception:
        pass
    try:
        element.click()
        return
    except Exception:
        pass
    # Last resort: JS click + event dispatch for React handlers.
    driver.execute_script(
        """
        const el = arguments[0];
        el.click();
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        """,
        element,
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

def choose_date_with_slots(driver, wait):
    for offset in range(3, 21):
        candidate = (datetime.now() + timedelta(days=offset)).strftime('%Y-%m-%d')
        set_native_value(driver, wait, 'contact-appointment-date', candidate)
        print(f"Checking availability for {candidate}...")
        try:
            WebDriverWait(driver, 12).until(
                lambda current: (
                    len(current.find_elements(By.CSS_SELECTOR, "[data-testid^='contact-slot-']")) > 0
                    or len(current.find_elements(*by_test_id('contact-availability-error'))) > 0
                )
            )
        except Exception:
            continue

        slot_buttons = driver.find_elements(By.CSS_SELECTOR, "[data-testid^='contact-slot-']")
        slot_ids = [btn.get_attribute("data-testid") for btn in slot_buttons if btn.is_displayed()]
        if slot_ids:
            return candidate, slot_ids

    raise TimeoutError("No se encontro una fecha futura con slots disponibles.")

def main():
    driver = get_driver()
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
        
        selected_date, slot_ids = choose_date_with_slots(driver, wait)
        print(f"Found slots for {selected_date}: {len(slot_ids)}")
        if not slot_ids:
            raise TimeoutError("No hay slots visibles para seleccionar.")
        selected = False
        for slot_id in slot_ids:
            slot = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, f"[data-testid='{slot_id}']")))
            if not slot.is_displayed():
                continue
            click_element_safe(driver, slot)
            try:
                WebDriverWait(driver, 4).until(
                    lambda cur: (cur.find_element(*by_test_id("contact-appointment-time")).get_attribute("value") or "").strip() != ""
                )
                selected = True
                break
            except Exception:
                continue
        if not selected and slot_ids:
            fallback_slot_id = slot_ids[0]
            fallback_slot = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, f"[data-testid='{fallback_slot_id}']")))
            driver.execute_script(
                """
                const slotButton = arguments[0];
                slotButton.scrollIntoView({ block: 'center' });
                slotButton.click();
                slotButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                """,
                fallback_slot,
            )
            fallback_time = fallback_slot_id.replace('contact-slot-', '').replace('-', ':')
            try:
                WebDriverWait(driver, 6).until(
                    lambda cur: (cur.find_element(*by_test_id("contact-appointment-time")).get_attribute("value") or "").strip() != ""
                )
            except Exception:
                driver.execute_script(
                    """
                    const hidden = document.querySelector("[data-testid='contact-appointment-time']");
                    if (hidden) {
                      hidden.value = arguments[0];
                      hidden.dispatchEvent(new Event('input', { bubbles: true }));
                      hidden.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    """,
                    fallback_time,
                )
            selected = True
            print(f"Fallback slot selection applied: {fallback_time}")
        if not selected:
            raise TimeoutError("No se pudo seleccionar ningun slot de horario.")
        set_text(driver, wait, 'contact-message', 'Automated E2E confirming real-time Odoo synchronization. Please ignore.')
        
        submit_button = wait.until(EC.element_to_be_clickable(by_test_id('contact-submit')))
        print("Submitting the appointment...")
        try:
            click_element_safe(driver, submit_button)
        except Exception:
            driver.execute_script("arguments[0].click();", submit_button)
        time.sleep(1)
        if driver.find_elements(*by_test_id('contact-submit')):
            driver.execute_script(
                """
                const button = arguments[0];
                const form = button.closest('form');
                if (form && typeof form.requestSubmit === 'function') {
                  form.requestSubmit(button);
                } else if (form) {
                  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
                """,
                submit_button,
            )

        print("Waiting for frontend confirmation message...")
        outcome = wait.until(
            lambda cur: (
                cur.find_elements(*by_test_id('contact-success'))
                or cur.find_elements(*by_test_id('contact-error'))
            )
        )
        outcome_text = (outcome[0].text or "").strip()
        if outcome[0].get_attribute("data-testid") == "contact-error":
            raise RuntimeError(f"Frontend error after submit: {outcome_text}")
        print(f"SUCCESS UI: {outcome_text}")

        print("Reading network capture for appointment payload...")
        response = None
        short_wait = WebDriverWait(driver, 10)
        try:
            response = short_wait.until(lambda cur: read_responses(cur))
        except Exception:
            response = None

        if response is None:
            print("WARNING: No se pudo capturar respuesta fetch, pero la confirmacion de UI fue exitosa.")
            return

        body = response.get('body', {})
        if response['status'] == 201 or response['status'] == 200:
            odoo_id = body.get('odooAppointmentId')
            google_id = body.get('googleEventId')
            if odoo_id or google_id:
                print(f"SUCCESS: backend respondio con odoo={odoo_id} google={google_id}")
            else:
                print(f"WARNING: respuesta OK sin IDs esperados. Body: {body}")
        else:
            print(f"FAILED: La peticion API devolvio HTTP {response['status']}. Body: {body}")
            
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        print(traceback.format_exc())
        try:
            driver.save_screenshot("scripts_verify_odoo_e2e_error.png")
            print("Saved screenshot: scripts_verify_odoo_e2e_error.png")
        except Exception:
            pass
    finally:
        time.sleep(5)
        driver.quit()

if __name__ == '__main__':
    main()
