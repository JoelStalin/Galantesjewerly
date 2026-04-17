import os
import time
import shutil
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

def copy_profile():
    import getpass
    src_base = os.path.join(os.environ['LOCALAPPDATA'], 'Google', 'Chrome', 'User Data')
    dest_base = os.path.join(os.environ['TEMP'], 'ChromeProxy')

    if not os.path.exists(dest_base):
        os.makedirs(dest_base)

    def safe_copy(src, dst):
        try:
            if os.path.isdir(src):
                if not os.path.exists(dst): os.makedirs(dst)
                for item in os.listdir(src):
                    # Saltar cachés para rapidez y evitar bloqueos duros
                    if item in ['Cache', 'Code Cache', 'blob_storage', 'Lock', 'SingletonLock']: continue
                    safe_copy(os.path.join(src, item), os.path.join(dst, item))
            else:
                shutil.copy2(src, dst)
        except Exception as e:
            pass # Ignorar archivos en uso

    print("Clonando 'Local State' (Claves de sesión)...")
    safe_copy(os.path.join(src_base, 'Local State'), os.path.join(dest_base, 'Local State'))

    print("Clonando 'Profile 6' al vuelo (Ignorando archivos bloqueados)...")
    safe_copy(os.path.join(src_base, 'Profile 6'), os.path.join(dest_base, 'Profile 6'))
    return dest_base

def main():
    print("🚀 Auto-mágico activado. Abriendo una instancia paralela transparente...")
    temp_dir = copy_profile()

    options = webdriver.ChromeOptions()
    options.add_argument(f"user-data-dir={temp_dir}")
    options.add_argument("profile-directory=Profile 6")
    options.add_argument("--start-maximized")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    try:
        driver = webdriver.Chrome(options=options)
    except Exception as e:
        print(f"❌ Error lanzando temp chrome: {e}")
        return

    url = "https://dash.cloudflare.com/8cbbddeadb799052dcc0844332ed93d3/tunnels/08d437c9-56ad-4910-80f9-33cca283d727/routes"
    driver.get(url)

    print("⏳ Esperando carga del entorno Zero Trust (12 s)...")
    time.sleep(12)

    try:
        inputs = driver.find_elements(By.TAG_NAME, "input")
        changed = False
        for inp in inputs:
            val = str(inp.get_attribute("value") or "")
            if "127.0.0.1" in val or "8000" in val or "http:" in val:
                inp.send_keys(Keys.CONTROL + "a")
                inp.send_keys(Keys.DELETE)
                time.sleep(1)
                inp.send_keys("localhost:3000")
                changed = True
                print("✅ Campo modificado con éxito a localhost:3000")
                break

        if changed:
            buttons = driver.find_elements(By.TAG_NAME, "button")
            for btn in buttons:
                if "Save" in btn.text or "Guardar" in btn.text:
                    try:
                        driver.execute_script("arguments[0].click();", btn)
                        print("✅ Botón de guardado pulsado.")
                        time.sleep(5)
                        break
                    except Exception as e:
                        pass

        # Exportar DOM por si algo falló
        with open("cloudflare_route_latest.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)

    except Exception as e:
        print(f"❌ Error manipulando DOM: {e}")

    finally:
        print("🧹 Limpiando webdriver clonado...")
        driver.quit()

if __name__ == "__main__":
    main()
