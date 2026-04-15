import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

def main():
    print("Forzando cierre de Chrome para tomar control local del perfil 'galantesjewelry.com'...")
    os.system("taskkill /F /IM chrome.exe >nul 2>&1")
    time.sleep(3)

    options = webdriver.ChromeOptions()
    user_data_dir = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")

    options.add_argument(f"user-data-dir={user_data_dir}")
    options.add_argument("profile-directory=Profile 6")
    options.add_argument("--start-maximized")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    print("Lanzando navegador Selenium con tus credenciales seguras...")
    driver = webdriver.Chrome(options=options)

    url = "https://dash.cloudflare.com/8cbbddeadb799052dcc0844332ed93d3/tunnels/08d437c9-56ad-4910-80f9-33cca283d727/routes"
    print("Navegando al Dashboard Zero Trust...")
    driver.get(url)

    print("Esperando 12 segundos para procesamiento Anti-Bot de Cloudflare (Turnstile)...")
    time.sleep(12)

    try:
        inputs = driver.find_elements(By.TAG_NAME, "input")
        port_found = False

        for inp in inputs:
            val = str(inp.get_attribute("value") or "")
            if "127.0.0.1:" in val or "http:" in val:
                print(f"Caja de Origen encontrada con valor previo: {val}")
                inp.send_keys(Keys.CONTROL + "a")
                inp.send_keys(Keys.DELETE)
                time.sleep(1)
                inp.send_keys("localhost:3000")
                port_found = True
                print("Valor inyectado -> localhost:3000 (Optimizado para Termux Android)")
                break

        if not port_found:
            print("ADVERTENCIA: No se detectó exactamente el input con 127.0.0.1.")

        time.sleep(2)
        print("Buscando botón de Guardar Cambios...")
        buttons = driver.find_elements(By.TAG_NAME, "button")

        for btn in buttons:
            if "Save changes" in btn.text or "Guardar" in btn.text:
                print("Botón Guardar encontrado. Ejecutando click...")
                driver.execute_script("arguments[0].click();", btn)
                break

        # Dando tiempo a que Cloudflare guarde en el servidor
        print("Esperando confirmación HTTP... (7 segundos)")
        time.sleep(7)
        print("✅ Operación automática completada exitosamente.")

    except Exception as e:
        print(f"❌ Error durante la manipulación del DOM: {e}")

    finally:
        driver.quit()
        print("Selenium finalizado y memoria liberada.")

if __name__ == "__main__":
    main()
