from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.getenv("E2E_BASE_URL", "https://galantesjewelry.com").rstrip("/")
PROFILE_NAME = os.getenv("SELENIUM_PROFILE", "Profile 9")
HEADLESS = os.getenv("SELENIUM_HEADLESS", "0") == "1"

CURRENT_DIR = Path(__file__).resolve().parent.parent
E2E_DIR = CURRENT_DIR / "tests" / "e2e"
if str(E2E_DIR) not in sys.path:
    sys.path.insert(0, str(E2E_DIR))

from profile_runtime import get_driver as get_profile_runtime_driver


def get_driver():
    driver, _ = get_profile_runtime_driver(PROFILE_NAME, headless=HEADLESS)
    return driver


def fetch_resource(driver, url: str) -> dict:
    return driver.execute_async_script(
        """
        const [url, done] = arguments;
        fetch(url, { credentials: 'include' })
          .then(async (response) => {
            const blob = await response.blob();
            done({
              ok: response.ok,
              status: response.status,
              contentType: response.headers.get('content-type') || '',
              size: blob.size,
              url: response.url,
            });
          })
          .catch((error) => done({ ok: false, status: 0, error: String(error), url }));
        """,
        url,
    )


def natural_size(driver, element) -> dict:
    return driver.execute_script(
        """
        return {
          complete: Boolean(arguments[0].complete),
          naturalWidth: Number(arguments[0].naturalWidth || 0),
          naturalHeight: Number(arguments[0].naturalHeight || 0),
          currentSrc: arguments[0].currentSrc || arguments[0].src || '',
        };
        """,
        element,
    )


def main() -> None:
    driver = get_driver()
    if not driver:
        print("BLOCKED: Chrome profile is locked. Close Chrome manually and rerun.")
        return

    try:
        wait = WebDriverWait(driver, 40)

        print("--- Verifying home branding ---")
        driver.get(f"{BASE_URL}/")

        logo = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "img[alt=\"Galante's\"]")))
        logo_metrics = natural_size(driver, logo)
        if not logo_metrics["complete"] or logo_metrics["naturalWidth"] <= 0:
          raise AssertionError(f"Navbar logo did not render correctly: {logo_metrics}")
        print(f"[OK] Logo rendered: {logo_metrics['currentSrc']}")

        favicon_href = driver.execute_script(
            "const el=document.querySelector('link[rel~=\"icon\"]'); return el ? el.href : '';"
        )
        if not favicon_href:
            raise AssertionError("Favicon link is missing.")
        favicon_check = fetch_resource(driver, favicon_href)
        if not favicon_check.get("ok") or favicon_check.get("size", 0) < 500:
            raise AssertionError(f"Favicon fetch failed: {favicon_check}")
        print(f"[OK] Favicon reachable: {favicon_check}")

        hero_background = driver.execute_script(
            """
            const node = document.querySelector('section.relative .absolute.inset-0.z-0.bg-cover.bg-center');
            if (!node) return '';
            return window.getComputedStyle(node).backgroundImage || '';
            """
        )
        match = re.search(r'url\("?(.*?)"?\)', hero_background)
        if not match:
            raise AssertionError(f"Hero background URL was not found: {hero_background}")
        hero_url = match.group(1)
        if "/api/image?id=" not in hero_url:
            raise AssertionError(f"Hero is not using managed image API: {hero_url}")
        hero_check = fetch_resource(driver, hero_url)
        if not hero_check.get("ok") or hero_check.get("size", 0) < 5000:
            raise AssertionError(f"Hero fetch failed: {hero_check}")
        print(f"[OK] Hero background reachable: {hero_check}")

        print("--- Verifying product images from Odoo ---")
        driver.get(f"{BASE_URL}/shop")
        cards = wait.until(
            lambda current: current.find_elements(By.CSS_SELECTOR, 'a[href^="/shop/"] img[src*="/api/products/image?id="]')
        )
        if len(cards) < 3:
            raise AssertionError(f"Expected at least 3 Odoo product images, found {len(cards)}")

        for index, image in enumerate(cards[:3], start=1):
            metrics = natural_size(driver, image)
            if not metrics["complete"] or metrics["naturalWidth"] <= 0:
                raise AssertionError(f"Product image {index} did not render: {metrics}")
            resource = fetch_resource(driver, metrics["currentSrc"])
            if not resource.get("ok") or resource.get("size", 0) < 5000:
                raise AssertionError(f"Product image {index} fetch failed: {resource}")
            print(f"[OK] Product image {index}: {resource['url']} ({resource['size']} bytes)")

        print("PASS: Production branding, hero, and Odoo product images verified.")
    finally:
        time.sleep(2)
        driver.quit()


if __name__ == "__main__":
    main()
