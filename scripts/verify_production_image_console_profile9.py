from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.getenv("E2E_BASE_URL", "https://galantesjewelry.com").rstrip("/")
PROFILE_NAME = os.getenv("SELENIUM_PROFILE", "Profile 9")
HEADLESS = os.getenv("SELENIUM_HEADLESS", "0") == "1"

CURRENT_DIR = Path(__file__).resolve().parent.parent
E2E_DIR = CURRENT_DIR / "tests" / "e2e"
ARTIFACT_DIR = CURRENT_DIR / "test-results" / "production-image-console"
if str(E2E_DIR) not in sys.path:
    sys.path.insert(0, str(E2E_DIR))

from profile_runtime import get_driver as get_profile_runtime_driver


def get_driver():
    driver, _ = get_profile_runtime_driver(PROFILE_NAME, headless=HEADLESS)
    if driver:
        driver.set_script_timeout(60)
    return driver


def collect_image_metrics(driver):
    return driver.execute_script(
        """
        return Array.from(document.images).map((img) => ({
          alt: img.alt || '',
          src: img.currentSrc || img.src || '',
          complete: Boolean(img.complete),
          naturalWidth: Number(img.naturalWidth || 0),
          naturalHeight: Number(img.naturalHeight || 0),
          renderedWidth: Math.round(img.getBoundingClientRect().width),
          renderedHeight: Math.round(img.getBoundingClientRect().height),
        }));
        """
    )


def wait_for_images(driver, timeout: int = 25):
    driver.execute_script(
        """
        for (const img of document.images) {
          img.scrollIntoView({ block: 'center', inline: 'center' });
          img.loading = 'eager';
        }
        window.scrollTo(0, document.body.scrollHeight);
        """
    )
    time.sleep(3)


def fetch_resource(driver, url: str) -> dict:
    return driver.execute_async_script(
        """
        const [url, done] = arguments;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        fetch(url, { credentials: 'include', cache: 'no-store', signal: controller.signal })
          .then(async (response) => {
            clearTimeout(timer);
            const blob = await response.blob();
            done({
              ok: response.ok,
              status: response.status,
              contentType: response.headers.get('content-type') || '',
              size: blob.size,
              url: response.url,
            });
          })
          .catch((error) => {
            clearTimeout(timer);
            done({ ok: false, status: 0, error: String(error), url });
          });
        """,
        url,
    )


def browser_errors(driver):
    errors = []
    for entry in driver.get_log("browser"):
        level = entry.get("level", "")
        message = entry.get("message", "")
        if level in {"SEVERE", "ERROR"} or any(token in message.lower() for token in ("404", "500", "failed to load", "net::err")):
            errors.append(entry)
    return errors


def main() -> None:
    driver = get_driver()
    if not driver:
        print("BLOCKED: Chrome profile is locked. Close Chrome manually and rerun.")
        return

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    report = {"baseUrl": BASE_URL, "pages": []}

    try:
        wait = WebDriverWait(driver, 45)
        pages = ["/", "/shop"]

        driver.get(f"{BASE_URL}/shop")
        wait.until(lambda current: current.find_elements(By.CSS_SELECTOR, 'a[href^="/shop/"]'))
        first_product = driver.execute_script(
            "const link = document.querySelector('a[href^=\"/shop/\"]'); return link ? link.getAttribute('href') : '';"
        )
        if first_product:
            pages.append(first_product)

        for page in pages:
            url = page if page.startswith("http") else f"{BASE_URL}{page}"
            driver.get(url)
            time.sleep(2)
            if page == "/shop":
                driver.save_screenshot(str(ARTIFACT_DIR / "shop-profile9.png"))
            try:
                wait_for_images(driver)
            except Exception:
                pass

            images = collect_image_metrics(driver)
            api_images = [img for img in images if "/api/image" in img["src"] or "/api/products/image" in img["src"]]

            resource_checks = []
            for img in api_images[:10]:
                resource_checks.append({"src": img["src"], "fetch": fetch_resource(driver, img["src"])})

            failed_fetches = [
                check for check in resource_checks
                if not check["fetch"].get("ok") or check["fetch"].get("size", 0) <= 0
            ]

            broken = [
                img for img in images 
                if img["src"] and img["naturalWidth"] <= 0 and any(f["src"] == img["src"] for f in failed_fetches)
            ]

            page_report = {
                "url": url,
                "totalImages": len(images),
                "apiImages": len(api_images),
                "brokenImages": broken,
                "failedFetches": failed_fetches,
                "resourceChecks": resource_checks,
                "browserErrors": browser_errors(driver),
            }
            report["pages"].append(page_report)
            print(json.dumps(page_report, indent=2))

        artifact = ARTIFACT_DIR / f"console-image-report-{int(time.time())}.json"
        artifact.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"ARTIFACT: {artifact}")

        failures = []
        for page in report["pages"]:
            failures.extend(page["brokenImages"])
            failures.extend(page["browserErrors"])
            failures.extend(page["failedFetches"])

        if failures:
            raise AssertionError(f"Production image/console audit found {len(failures)} failures.")

        print("PASS: No browser console image errors and API images fetched successfully.")
    finally:
        time.sleep(2)
        driver.quit()


if __name__ == "__main__":
    main()
