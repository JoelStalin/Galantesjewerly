"""n8n Course Content Ingestion & Scraper Script

Authenticates to apps.learn.n8n.io using provided credentials.
Auto-enrolls and extracts course N8N103 ("In Practice: AI, Testing & Best Practices").
Saves structured markdown captures to docs/n8n-course-captures/.
"""

import os
import sys
import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

LOGIN_URL = "https://apps.learn.n8n.io/login"
COURSE_URL = "https://apps.learn.n8n.io/learning/course/course-v1:n8n+N8N103+2026H2/block-v1:n8n+N8N103+2026H2+type@sequential+block@b1cd1f877c35456b92926000c415190c/block-v1:n8n+N8N103+2026H2+type@vertical+block@fd9617aea8fc4eeebf2aa158f7011e9e"
USERNAME = "joelstalin2105"
PASSWORD = "Pandemia@2020"

OUTPUT_DIR = os.path.join(os.getcwd(), "docs", "n8n-course-captures")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def get_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)

    try:
        driver = webdriver.Chrome(options=options)
        return driver
    except Exception as e:
        print(f"[WARN] Launching standard Chrome options: {e}")
        options.add_argument("--headless=new")
        options.add_argument("--disable-gpu")
        try:
            return webdriver.Chrome(options=options)
        except Exception as e2:
            print(f"[ERROR] Headless Chrome launch also failed: {e2}")
            return None

def login_and_capture():
    driver = get_driver()
    if not driver:
        print("[SKIP] Chrome driver initialization failed.")
        return

    try:
        print(f"[INFO] Opening Login Page: {LOGIN_URL}")
        driver.get(LOGIN_URL)
        time.sleep(5)

        # Look for login form elements
        try:
            email_field = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='text'], input[type='email'], input[name='email'], input[name='username'], input[id*='email'], input[id*='user']"))
            )
            email_field.clear()
            email_field.send_keys(USERNAME)
            print("[INFO] Typed username into login form.")

            pass_field = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
            pass_field.clear()
            pass_field.send_keys(PASSWORD)
            print("[INFO] Typed password into login form.")

            submit_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")
            submit_btn.click()
            print("[INFO] Submitted login form. Waiting for session creation...")
            time.sleep(8)
        except Exception as e:
            print(f"[WARN] Direct login form interaction: {e}")

        # Check post-login URL or dashboard
        print(f"[INFO] Current URL post-login: {driver.current_url}")

        # Navigate to target course URL
        print(f"[INFO] Navigating to target course: {COURSE_URL}")
        driver.get(COURSE_URL)
        time.sleep(6)

        # Check if an "Enroll" or "Resume Course" button is present
        page_source = driver.page_source.lower()
        if "enroll" in page_source:
            try:
                enroll_btn = driver.find_element(By.XPATH, "//button[contains(translate(text(), 'ENROLL', 'enroll'), 'enroll')] | //a[contains(translate(text(), 'ENROLL', 'enroll'), 'enroll')]")
                enroll_btn.click()
                print("[INFO] Clicked Enroll button!")
                time.sleep(5)
                driver.get(COURSE_URL)
                time.sleep(5)
            except Exception as enroll_err:
                print(f"[WARN] Enroll button click: {enroll_err}")

        title = driver.title
        body_element = driver.find_element(By.TAG_NAME, "body")
        body_text = body_element.text

        print(f"[SUCCESS] Page Title: '{title}' ({len(body_text)} chars)")

        # Collect links for other blocks/modules in the course
        links = driver.find_elements(By.TAG_NAME, "a")
        course_links = []
        for link in links:
            href = link.get_attribute("href") or ""
            text = link.text.strip()
            if "course-v1:n8n" in href or "learning/course" in href:
                course_links.append({"text": text, "href": href})

        capture_file = os.path.join(OUTPUT_DIR, "n8n-course-103-master-capture.md")
        with open(capture_file, "w", encoding="utf-8") as f:
            f.write(f"# n8n Advanced Course N8N103 Capture & Lesson Extraction\n\n")
            f.write(f"- **URL:** {COURSE_URL}\n")
            f.write(f"- **Title:** {title}\n")
            f.write(f"- **Captured At:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(f"## Course Navigation & Links ({len(course_links)} found)\n\n")
            for cl in course_links[:30]:
                link_text = cl['text'] if cl['text'] else 'Lesson Block'
                f.write(f"- [{link_text}]({cl['href']})\n")
            f.write(f"\n## Captured Page Content\n\n")
            f.write(body_text)

        print(f"[SUCCESS] Master capture file written to: {capture_file}")

    except Exception as e:
        print(f"[ERROR] Capture process failed: {e}")
    finally:
        try:
            driver.quit()
        except Exception:
            pass

if __name__ == "__main__":
    login_and_capture()
