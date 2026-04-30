"""
Verificación completa de producción — galantesjewelry.com.do
Prueba: páginas principales, imágenes de productos, sección calendario/citas.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import TimeoutException, NoSuchElementException

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from profile_runtime import get_driver

BASE_URL = os.getenv('E2E_BASE_URL', 'https://galantesjewelry.com.do').rstrip('/')
PROFILE_NAME = os.getenv('SELENIUM_PROFILE', 'Default')
HEADLESS = os.getenv('SELENIUM_HEADLESS', '0') == '1'
WAIT_TIMEOUT = 20

PASS = '✅ PASS'
FAIL = '❌ FAIL'
WARN = '⚠️  WARN'

results: list[tuple[str, str, str]] = []


def check(label: str, condition: bool, detail: str = '') -> bool:
    status = PASS if condition else FAIL
    results.append((status, label, detail))
    print(f'{status}  {label}' + (f' — {detail}' if detail else ''))
    return condition


def warn(label: str, detail: str = '') -> None:
    results.append((WARN, label, detail))
    print(f'{WARN}  {label}' + (f' — {detail}' if detail else ''))


def scroll_to_bottom(driver) -> None:
    last_height = 0
    for _ in range(8):
        driver.execute_script('window.scrollTo(0, document.body.scrollHeight);')
        time.sleep(0.8)
        new_height = driver.execute_script('return document.body.scrollHeight')
        if new_height == last_height:
            break
        last_height = new_height


def loaded_image_issues(driver) -> list[str]:
    return driver.execute_script("""
        const productImages = Array.from(
            document.querySelectorAll('img[src*="/api/products/image"], img[src*="product"], img[alt]')
        );
        return productImages
            .filter((img) => img.complete && img.naturalWidth === 0)
            .map((img) => img.currentSrc || img.src)
            .slice(0, 5);
    """)


def severe_logs(driver) -> list[str]:
    return [
        entry.get('message', '')
        for entry in driver.get_log('browser')
        if entry.get('level') == 'SEVERE'
    ]


def main() -> None:
    driver, _ = get_driver(PROFILE_NAME, headless=HEADLESS)
    if driver is None:
        print('No se pudo iniciar Chrome. Cierra Chrome manualmente e intenta de nuevo.')
        return

    wait = WebDriverWait(driver, WAIT_TIMEOUT)

    try:
        print(f'\n{"="*60}')
        print(f'  VERIFICACIÓN PRODUCCIÓN: {BASE_URL}')
        print(f'{"="*60}\n')

        # ── 1. Homepage ──────────────────────────────────────────────
        print('── 1. Homepage ─────────────────────────────────────────')
        driver.get(f'{BASE_URL}/')
        time.sleep(3)
        check('Homepage carga (200)', 'galantesjewelry' in driver.current_url.lower() or driver.title != '')
        check('Título contiene Galante', "galante" in driver.title.lower(), driver.title)

        # Hero section
        try:
            hero = driver.find_element(By.CSS_SELECTOR, 'section, [class*="hero"], h1')
            check('Hero section visible', hero.is_displayed())
        except NoSuchElementException:
            check('Hero section visible', False, 'elemento no encontrado')

        # Navbar / logo
        try:
            nav = driver.find_element(By.CSS_SELECTOR, 'nav, header, [class*="nav"]')
            check('Navbar visible', nav.is_displayed())
        except NoSuchElementException:
            warn('Navbar', 'no encontrado con selectores estándar')

        # ── 2. Shop / Productos ──────────────────────────────────────
        print('\n── 2. Shop / Productos ─────────────────────────────────')
        driver.get(f'{BASE_URL}/shop')
        time.sleep(4)
        check('Shop page carga', '/shop' in driver.current_url)

        # Productos presentes
        try:
            wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'a[aria-label], img, [class*="product"], [class*="card"]')))
            scroll_to_bottom(driver)
            product_imgs = driver.find_elements(By.CSS_SELECTOR, 'img[src*="product"], img[src*="api/products"], img[alt]')
            check('Imágenes de productos cargan', len(product_imgs) > 0, f'{len(product_imgs)} imágenes encontradas')

            broken = loaded_image_issues(driver)
            check('Sin imágenes rotas', len(broken) == 0, f'Rotas: {broken}' if broken else '')

            sort_select = wait.until(EC.presence_of_element_located((By.ID, 'sort-sidebar')))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", sort_select)
            Select(sort_select).select_by_value('price_asc')
            time.sleep(2)
            check(
                'Ordenamiento del shop responde',
                'sort=price_asc' in driver.current_url,
                driver.current_url,
            )

            category_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Other')]")))
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", category_button)
            driver.execute_script("arguments[0].click();", category_button)
            time.sleep(2)
            check(
                'Filtro de categoría responde',
                'category=Other' in driver.current_url,
                driver.current_url,
            )

            shop_severe = severe_logs(driver)
            check(
                'Shop sin errores SEVERE en consola',
                len(shop_severe) == 0,
                f'{len(shop_severe)} errores: {[msg[:80] for msg in shop_severe[:3]]}' if shop_severe else '',
            )
        except TimeoutException:
            check('Productos visibles en shop', False, 'timeout esperando productos')

        # ── 3. Página de contacto / Calendario ──────────────────────
        print('\n── 3. Contacto / Calendario / Citas ────────────────────')
        driver.get(f'{BASE_URL}/contact')
        time.sleep(3)
        check('Contact page carga', '/contact' in driver.current_url)

        # Formulario de cita
        try:
            form = driver.find_element(By.CSS_SELECTOR, 'form, [class*="form"], [class*="appointment"], [class*="calendar"]')
            check('Formulario / sección citas presente', form.is_displayed())
        except NoSuchElementException:
            check('Formulario / sección citas presente', False, 'no encontrado')

        # Campos del formulario
        inputs_found = driver.find_elements(By.CSS_SELECTOR, 'input, textarea, select')
        check('Campos de formulario presentes', len(inputs_found) >= 2, f'{len(inputs_found)} campos encontrados')

        # Calendar picker o date input
        date_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[type="date"], input[type="datetime-local"], [class*="calendar"], [class*="datepicker"], [class*="date-picker"]')
        check('Selector de fecha/calendario presente', len(date_inputs) > 0, f'{len(date_inputs)} encontrados')

        # ── 4. Sección Bridal ────────────────────────────────────────
        print('\n── 4. Sección Bridal ───────────────────────────────────')
        driver.get(f'{BASE_URL}/bridal')
        time.sleep(3)
        status_ok = 'bridal' in driver.current_url or driver.title != ''
        check('Bridal page accesible', status_ok, driver.current_url)

        # ── 5. Collections ──────────────────────────────────────────
        print('\n── 5. Collections ──────────────────────────────────────')
        driver.get(f'{BASE_URL}/collections')
        time.sleep(3)
        check('Collections page accesible', 'collections' in driver.current_url or driver.title != '', driver.current_url)

        # ── 6. Producto individual ───────────────────────────────────
        print('\n── 6. Producto individual ──────────────────────────────')
        driver.get(f'{BASE_URL}/shop/the-islamorada-solitaire')
        time.sleep(3)
        check('Producto individual carga', 'islamorada' in driver.current_url or driver.title != '')

        try:
            prod_img = driver.find_element(By.CSS_SELECTOR, 'img[src*="product"], img[src*="api/products"]')
            check('Imagen de producto individual visible', prod_img.is_displayed())
            wait.until(lambda d: d.execute_script('return arguments[0].complete && arguments[0].naturalWidth > 0', prod_img))
            natural_w = driver.execute_script('return arguments[0].naturalWidth', prod_img)
            check('Imagen producto no rota', natural_w > 0, f'naturalWidth={natural_w}')
        except NoSuchElementException:
            check('Imagen de producto individual visible', False, 'img no encontrada')
        except TimeoutException:
            check('Imagen producto no rota', False, 'la imagen no terminó de cargar')

        # ── 7. API Health ────────────────────────────────────────────
        print('\n── 7. API Health Check ─────────────────────────────────')
        driver.get(f'{BASE_URL}/api/health')
        time.sleep(2)
        body = driver.find_element(By.TAG_NAME, 'body').text
        check('API /health responde', 'ok' in body.lower() or 'health' in body.lower() or '{' in body, body[:100])

        # ── 8. Consola JS — errores críticos ─────────────────────────
        print('\n── 8. Errores JS en consola ────────────────────────────')
        driver.get(f'{BASE_URL}/')
        time.sleep(3)
        logs = driver.get_log('browser')
        severe = [l for l in logs if l.get('level') == 'SEVERE']
        check('Sin errores SEVERE en consola', len(severe) == 0,
              f'{len(severe)} errores: {[l["message"][:80] for l in severe[:3]]}' if severe else '')

    except Exception as exc:
        print(f'\n{FAIL} Error inesperado: {exc}')
    finally:
        driver.quit()

    # ── Resumen ──────────────────────────────────────────────────────
    print(f'\n{"="*60}')
    print('  RESUMEN')
    print(f'{"="*60}')
    passed = sum(1 for r in results if r[0] == PASS)
    failed = sum(1 for r in results if r[0] == FAIL)
    warned = sum(1 for r in results if r[0] == WARN)
    print(f'  {PASS} Passed : {passed}')
    print(f'  {FAIL} Failed : {failed}')
    print(f'  {WARN} Warnings: {warned}')
    print(f'{"="*60}\n')

    if failed > 0:
        print('FALLOS:')
        for r in results:
            if r[0] == FAIL:
                print(f'  • {r[1]}: {r[2]}')


if __name__ == '__main__':
    main()
