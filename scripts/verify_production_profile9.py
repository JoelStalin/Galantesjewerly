import os
import time
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import sys
from pathlib import Path

BASE_URL = os.getenv("E2E_BASE_URL", "https://galantesjewelry.com").rstrip("/")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
CURRENT_DIR = Path(__file__).resolve().parent.parent
E2E_DIR = CURRENT_DIR / "tests" / "e2e"
if str(E2E_DIR) not in sys.path:
    sys.path.insert(0, str(E2E_DIR))
from profile_runtime import get_driver as get_profile_runtime_driver


def get_driver(profile_cmd=None):
    selected_profile = profile_cmd or os.getenv("SELENIUM_PROFILE", "Profile 9")
    headless = os.getenv("SELENIUM_HEADLESS", "0") == "1"
    driver, _ = get_profile_runtime_driver(selected_profile, headless=headless)
    return driver


def verify_production():
    driver = get_driver()
    if not driver:
        return

    try:
        print("--- Verifying Home ---")
        driver.get(f"{BASE_URL}/")
        time.sleep(3)
        
        # Check Logo
        try:
            logo = driver.find_element(By.XPATH, "//img[@alt=\"Galante's\"]")
            src = logo.get_attribute("src")
            print(f"[OK] Logo found: {src}")
            if "photoroom.webp" in src or "error" in src:
                print("[WARNING] Logo seems to be incorrect or broken.")
        except:
            print("[ERROR] Logo not found.")

        # Check Typography (Outfit)
        body_font = driver.execute_script("return window.getComputedStyle(document.body).fontFamily")
        print(f"[OK] Body Typography: {body_font}")
        if "Outfit" not in body_font:
             print("[WARNING] Outfit font does not seem to be active.")

        # 2. Verify WWW Redirect
        print("\n--- Verifying WWW Redirect ---")
        driver.get("https://www.galantesjewelry.com/")
        time.sleep(3)
        current_url = driver.current_url
        print(f"[OK] Current URL after entering WWW: {current_url}")
        if "www." in current_url:
            print("[WARNING] WWW to root redirect failed (still on www).")

        # 3. Verify Admin & OAuth
        print("\n--- Verifying Admin & Google OAuth Redirect URI ---")
        driver.get(f"{BASE_URL}/admin/dashboard?tab=integrations")
        time.sleep(3)

        # Check if login is required
        if "/admin/login" in driver.current_url:
            print("Logging in to Admin...")
            if not ADMIN_PASSWORD:
                print("[WARNING] ADMIN_PASSWORD no esta configurado; se omite el login admin.")
                return
            driver.find_element(By.ID, "username").send_keys(ADMIN_USERNAME)
            driver.find_element(By.ID, "password").send_keys(ADMIN_PASSWORD)
            driver.find_element(By.XPATH, "//button[@type='submit']").click()
            time.sleep(3)
            driver.get(f"{BASE_URL}/admin/dashboard?tab=integrations")
            time.sleep(2)

        # Trigger OAuth start directly (more robust than UI button text changes)
        try:
            driver.get(f"{BASE_URL}/api/admin/google/oauth/start?environment=production")
            time.sleep(3)
            
            auth_url = driver.current_url
            print(f"[OK] Google Auth URL: {auth_url}")
            
            expected_redirect = (
                f"redirect_uri={BASE_URL.replace(':', '%3A').replace('/', '%2F')}"
                "%2Fapi%2Fadmin%2Fgoogle%2Foauth%2Fcallback"
            )
            if expected_redirect in auth_url:
                print("[SUCCESS] Redirect URI is CORRECT.")
            else:
                print("[ERROR] Redirect URI is INCORRECT in Google URL.")
                
        except Exception as e:
            print(f"[ERROR] Verifying OAuth button: {e}")


    finally:
        print("\nPruebas finalizadas. Cerrando navegador en 5 segundos...")
        time.sleep(5)
        driver.quit()

if __name__ == "__main__":
    verify_production()
