from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import time

def diagnose():
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    
    try:
        url = "http://127.0.0.1:3000/"
        print(f"Connecting to {url}...")
        driver.get(url)
        time.sleep(5)
        print(f"Title: {driver.title}")
        print(f"Current URL: {driver.current_url}")
        
        # Check for error messages on page
        body_text = driver.find_element("tag name", "body").text
        if "Galante" in body_text:
            print("✅ Site is UP and showing brand content.")
        else:
            print("❌ Site is UP but brand content missing.")
            print(f"Page Preview: {body_text[:200]}")
            
    except Exception as e:
        print(f"❌ Error connecting: {str(e)}")
    finally:
        driver.quit()

if __name__ == "__main__":
    diagnose()
