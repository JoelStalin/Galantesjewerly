import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def main():
    print("Verificando la ruta de Cloudflare Tunnels con tu perfil 'galantesjewelry.com'...")
    options = webdriver.ChromeOptions()
    user_data_dir = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")

    options.add_argument(f"user-data-dir={user_data_dir}")
    options.add_argument("profile-directory=Profile 6")
    options.add_argument("--start-maximized")
    # Esconder señales de automatización para no disparar las trabas antibot de CF
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    try:
        driver = webdriver.Chrome(options=options)
    except Exception as e:
        if "already in use" in str(e):
            print("❌ ERROR: Chrome está abierto y protegiendo los archivos del Perfil.")
            print("❌ Por favor CIRRA TODAS LAS VENTANAS DE CHROME manualmente e intenta correr el script de nuevo.")
            return
        else:
            print(f"❌ Error lanzando Chrome: {e}")
            return

    try:
        url = "https://dash.cloudflare.com/8cbbddeadb799052dcc0844332ed93d3/tunnels/08d437c9-56ad-4910-80f9-33cca283d727/routes"
        driver.get(url)
        print("Cargando el Dashboard de Cloudflare... esperando 10 segundos el escaneo del navegador...")
        time.sleep(12)

        # Guardar DOM para que la IA lo verifique
        html = driver.page_source
        with open("cloudflare_route_dom.html", "w", encoding="utf-8") as f:
            f.write(html)

        print("✅ ¡DOM de configuración extraído y guardado como cloudflare_route_dom.html para revisión técnica!")

        # Mantener abierto 5 segundos para seguridad visual
        time.sleep(5)
    except Exception as e:
        print(f"❌ Ocurrió un error leyendo el panel: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
