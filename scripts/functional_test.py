import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def run_functional_check():
    print("🚀 Iniciando Pruebas Funcionales en Dominio Público...")

    chrome_options = Options()
    chrome_options.add_argument("--headless") # Headless for automated execution
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    # Use local profile as per rules if needed, but for public check a fresh session is fine

    driver = webdriver.Chrome(options=chrome_options)
    wait = WebDriverWait(driver, 15)

    try:
        # 1. Home Page Check
        print("🔍 Verificando Home Page...")
        driver.get("https://galantesjewelry.com")
        assert "Galante" in driver.title
        print("✅ Home Page: OK")

        # 2. Collections Page Check
        print("🔍 Verificando Colecciones...")
        driver.get("https://galantesjewelry.com/collections")
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "h1")))
        print("✅ Collections: OK")

        # 3. Admin Login Accessibility
        print("🔍 Verificando Acceso a Admin...")
        driver.get("https://admin.galantesjewelry.com/admin/login")
        wait.until(EC.presence_of_element_located((By.NAME, "username")))
        print("✅ Admin Login UI: OK")

        # 4. Regression: Image Bridge Test
        # (Assuming we have a known image ID or we check the API directly)
        print("🔍 Verificando Image Bridge API...")
        driver.get("https://admin.galantesjewelry.com/api/image?id=test.webp")
        # Should NOT be a 502, might be 404 if not exists but API must respond
        status = driver.page_source
        if "Bad Gateway" in status:
             print("❌ Error: Bad Gateway detecting in API!")
        else:
             print("✅ Image Bridge API responds: OK")

    except Exception as e:
        print(f"❌ FALLO EN PRUEBAS: {str(e)}")
    finally:
        driver.quit()
        print("🏁 Pruebas Finalizadas.")

if __name__ == "__main__":
    run_functional_check()
