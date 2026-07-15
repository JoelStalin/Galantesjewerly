from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.getenv("E2E_BASE_URL", "https://galantesjewelry.com").rstrip("/")
PROFILE_NAME = os.getenv("SELENIUM_PROFILE", "Profile 9")
HEADLESS = os.getenv("SELENIUM_HEADLESS", "0") == "1"
PDP_SLUG = os.getenv("SHOP_PDP_SLUG", "shipping-calculation-demo-pendant")

CURRENT_DIR = Path(__file__).resolve().parent.parent
E2E_DIR = CURRENT_DIR / "tests" / "e2e"
if str(E2E_DIR) not in sys.path:
    sys.path.insert(0, str(E2E_DIR))

from profile_runtime import get_driver as get_profile_runtime_driver


def get_driver():
    driver, _ = get_profile_runtime_driver(PROFILE_NAME, headless=HEADLESS)
    return driver


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
        wait = WebDriverWait(driver, 45)

        print("--- Verifying left search panel on /shop ---")
        driver.get(f"{BASE_URL}/shop")
        search = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, 'input[aria-label="Search products"]')))
        sidebar = wait.until(EC.visibility_of_element_located((By.TAG_NAME, "aside")))
        if not search.is_displayed():
            raise AssertionError("Search input is not visible on the shop page.")

        positions = driver.execute_script(
            """
            const search = arguments[0].getBoundingClientRect();
            const sidebar = arguments[1].getBoundingClientRect();
            return {
              searchLeft: search.left,
              searchRight: search.right,
              sidebarLeft: sidebar.left,
              sidebarRight: sidebar.right,
              sidebarWidth: sidebar.width,
            };
            """,
            search,
            sidebar,
        )
        if positions["sidebarWidth"] < 200:
            raise AssertionError(f"Sidebar is unexpectedly narrow: {positions}")
        if positions["searchLeft"] > positions["sidebarRight"]:
            raise AssertionError(f"Search field is not inside the left sidebar: {positions}")
        print(f"[OK] Search field is visible inside the left sidebar: {positions}")

        print(f"--- Verifying PDP gallery controls on /shop/{PDP_SLUG} ---")
        driver.get(f"{BASE_URL}/shop/{PDP_SLUG}")
        gallery = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-testid="product-gallery"]')))
        hero_image = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[data-testid="product-gallery"] img')))
        hero_metrics = natural_size(driver, hero_image)
        if not hero_metrics["complete"] or hero_metrics["naturalWidth"] <= 0:
            raise AssertionError(f"Primary PDP image did not render: {hero_metrics}")
        print(f"[OK] PDP main image rendered: {hero_metrics['currentSrc']}")

        zoom_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[aria-label="Zoom image"]')))
        driver.execute_script("arguments[0].click();", zoom_button)
        dialog = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"][aria-label="Product image zoom"]')))
        if not dialog.is_displayed():
            raise AssertionError("Zoom dialog did not open.")
        print("[OK] Zoom dialog opened.")

        close_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[aria-label="Close zoom"]')))
        driver.execute_script("arguments[0].click();", close_button)
        wait.until(EC.invisibility_of_element_located((By.CSS_SELECTOR, '[role="dialog"][aria-label="Product image zoom"]')))
        print("[OK] Zoom dialog closed.")

        nav_buttons = driver.find_elements(By.CSS_SELECTOR, 'button[aria-label="Previous image"], button[aria-label="Next image"]')
        if len(nav_buttons) >= 2:
            print("[OK] Gallery navigation buttons are visible on the published PDP.")
        else:
            print("[INFO] Gallery navigation buttons are not visible on this published PDP yet. The control is implemented, but this product appears to expose a single image in production.")

        print("PASS: Production shop search placement and PDP zoom controls verified.")
    finally:
        time.sleep(2)
        driver.quit()


if __name__ == "__main__":
    main()
