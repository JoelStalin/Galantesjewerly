# Estrategia de Testing (Selenium)

Toda prueba automatizada E2E (End-to-End) o funcional que se ejecute a nivel exploratorio o de verificación bajo este repositorio mediante Selenium debe seguir de forma OBLIGATORIA el patrón de "Perfil de Usuario Host".

Esto es para prevenir que las pruebas generen ventanas estériles, permitir validación visual de la cuenta (como es el caso de un Dashboard o Cloudflare) y evitar ser bloqueados por anti-bots de plataformas productivas.

## 🛠️ Reglas Mandatorias de Scripts de Selenium

1. **Deshabilitar Flags de Automatización**:
   Todo script de Chrome debe inyectar opciones experimentales para evadir bloqueos severos (e.g. Cloudflare Turnstile).
2. **Utilizar el User Data Directory del Host**:
   A menos que sea en contenedor, el script debe tomar el entorno principal local en `%LOCALAPPDATA%\Google\Chrome\User Data`.
3. **Manejo de Bloqueos de Procesos (Locks)**:
   Dado que Chrome bloquea la base de datos de sesión si hay una ventana paralela abierta, el código DEBE incluir un bloque `try/except` general al iniciar el driver. Si intercepta el mensaje "already in use", el script jamás debe crashear abrumadoramente ni hacer un `taskkill` agresivo. En su lugar, debe imprimir en consola un mensaje amigable pidiéndole al humano que cierre Chrome ("Por favor cierra Chrome manualmente").
4. **Modo NO Headless por Defecto:**
   Dado que frecuentemente realizamos validaciones de UI, la configuración headless solo se habilitará al pasar mediante pipelining, de otra forma, siempre será interactivo (--start-maximized).

### 📄 Plantilla Requerida (`python_selenium_template.py`)

```python
import os
import time
from selenium import webdriver

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
            print(f"❌ Error lanzando Chrome: {e}")
        return None
```
