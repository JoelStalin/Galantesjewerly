import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def get_driver(profile_cmd="Profile 9"):
    options = webdriver.ChromeOptions()
    # ChromeDriver regressions on Windows can fail when a parent User Data
    # directory is combined with --profile-directory. Point directly at the
    # existing Profile 9 directory instead; this preserves the real profile.
    user_data_dir = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data\Profile 9")

    options.add_argument(f"user-data-dir={user_data_dir}")
    options.add_argument("--start-maximized")
    # Chrome 150 can fail before creating DevToolsActivePort when Selenium
    # attaches to a persistent Windows profile. Let Chrome allocate its own
    # debugging port and avoid GPU/shared-memory startup races.
    options.add_argument("--remote-debugging-port=0")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--headless=new")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    try:
        driver = webdriver.Chrome(options=options)
        return driver
    except Exception as e:
        err_str = str(e)
        if "already in use" in err_str or "locked" in err_str or "Chrome instance exited" in err_str:
            print("ERROR: Chrome is open or the profile is locked. PLEASE CLOSE ALL CHROME WINDOWS manually and try again to use Profile 9.")
        else:
            print(f"Error launching Chrome: {err_str}")
        return None


def verify_production():
    driver = get_driver("Profile 9")
    if not driver:
        return

    try:
        print("--- Verifying Home ---")
        driver.get("https://galantesjewelry.com/")
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
        driver.get("https://galantesjewelry.com/admin/dashboard?tab=integrations")
        time.sleep(3)

        # Check if login is required
        if "/admin/login" in driver.current_url:
            print("Logging in to Admin...")
            driver.find_element(By.ID, "username").send_keys("admin")
            driver.find_element(By.ID, "password").send_keys("Galantesjewelry#33036")
            driver.find_element(By.XPATH, "//button[@type='submit']").click()
            time.sleep(3)
            driver.get("https://galantesjewelry.com/admin/dashboard?tab=integrations")
            time.sleep(2)

        # Click Connect Google Owner
        try:
            connect_btn = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Connect Google Owner')]"))
            )
            connect_btn.click()
            time.sleep(3)
            
            auth_url = driver.current_url
            print(f"[OK] Google Auth URL: {auth_url}")
            
            if "redirect_uri=https%3A%2F%2Fgalantesjewelry.com%2Fapi%2Fadmin%2Fgoogle%2Foauth%2Fcallback" in auth_url:
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
