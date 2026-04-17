import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def test_url(driver, url, description):
    print(f"\n--- Testing {description} ({url}) ---")
    try:
        driver.set_page_load_timeout(10)
        driver.get(url)
        time.sleep(2)

        page_title = driver.title
        page_source = driver.page_source

        if "1016 Origin DNS error" in page_source or "1016" in page_title:
            print("❌ Result: ERROR 1016 (Cloudflare Tunnel Routing Error)")
        elif "Error" in page_title and "Cloudflare" in page_source:
            print(f"❌ Result: Cloudflare Error detected: {page_title}")
        elif not page_title:
             print(f"❌ Result: Page loaded but NO title found. Status uncertain.")
        else:
            print(f"✅ Result: SUCCESS")
            print(f"✅ Page Title: {page_title}")

    except Exception as e:
        print(f"❌ Result: FAILED to connect or load. Error: {e}")

def get_driver(profile_cmd="Profile 6"):
    options = webdriver.ChromeOptions()
    user_data_dir = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")

    options.add_argument(f"user-data-dir={user_data_dir}")
    options.add_argument(f"profile-directory={profile_cmd}")
    options.add_argument("--start-maximized")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    try:
        driver = webdriver.Chrome(options=options)
        return driver
    except Exception as e:
        if "already in use" in str(e):
            print("❌ ERROR: Chrome está abierto. CIERRA TODAS LAS VENTANAS DE CHROME manualmente e intenta de nuevo para poder usar el perfil.")
        else:
            print(f"❌ Error lanzando Chrome. Si es un session crash, cierra otras consolas o perfiles: {e}")
        return None

if __name__ == "__main__":
    print("Iniciando pruebas E2E con Selenium usando Perfil de Host (Reglas AI aplicadas)...")
    driver = get_driver()
    if driver:
        # Test internal Termux/Node URL
        test_url(driver, "http://192.168.12.193:8000", "Servidor Local Next.js Android (Puerto 8000)")

        # Test public URL (Cloudflare Tunnel)
        test_url(driver, "https://galantesjewelry.com", "Dominio Público (SSL)")
        test_url(driver, "https://www.galantesjewelry.com", "Subdominio Público WWW (SSL)")

        print("\n--- Pruebas finalizadas ---")
        driver.quit()
