import json
import os
import sys
import time
from pathlib import Path
from selenium.webdriver.common.by import By

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tests" / "e2e"))
from profile_runtime import get_driver as get_profile_driver


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "data" / "inventory-agent" / "evidence" / "orca-local"


def main():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    driver, runtime_profile = get_profile_driver("Profile 9", headless=False)
    if not driver:
        raise SystemExit(2)
    result = {"url": os.environ.get("ORCA_TEST_URL", "http://127.0.0.1:4173"), "profile": str(runtime_profile), "loaded": False, "title": "", "console": [], "errors": []}
    try:
        driver.get(result["url"])
        # The built UI intentionally shows a boot animation for ~3.4s before mounting the canvas.
        time.sleep(6)
        result["loaded"] = True
        result["title"] = driver.title
        result["bodyTextLength"] = len(driver.find_element(By.TAG_NAME, "body").text)
        result["console"] = driver.get_log("browser")
        result["errors"] = [entry for entry in result["console"] if entry.get("level") in {"SEVERE", "ERROR"}]
        driver.save_screenshot(str(EVIDENCE / "orca-local.png"))
    finally:
        result["finishedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        (EVIDENCE / "orca-local.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        driver.quit()
    print(json.dumps(result, indent=2))
    raise SystemExit(1 if result["errors"] else 0)


if __name__ == "__main__":
    main()
