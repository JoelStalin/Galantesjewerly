from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
import time

def verify_production():
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    
    url = "https://galantesjewelry.com/shop"
    print(f"Checking Production: {url}")
    
    try:
        driver.get(url)
        time.sleep(8) # Wait for hydration and Odoo sync
        
        print(f"Title: {driver.title}")
        
        # 1. Check for Sidebar
        sidebars = driver.find_elements(By.TAG_NAME, "aside")
        has_sidebar = len(sidebars) > 0
        
        # 2. Check for Hero
        page_source = driver.page_source
        has_hero_text = "Shop Fine Jewelry" in page_source
        
        # 3. Check for Categories
        has_deliveries = "Deliveries" in page_source
        
        print(f"--- VERDICT ---")
        print(f"Sidebar Present: {'✅ YES' if has_sidebar else '❌ NO'}")
        print(f"Hero Text Present: {'✅ YES' if has_hero_text else '❌ NO'}")
        print(f"Deliveries Category Sync: {'✅ YES' if has_deliveries else '❌ NO'}")
        
        if not has_sidebar or not has_hero_text:
            print("\nRESULT: DEPLOYMENT NOT LIVE YET. Production is still showing the old version.")
        else:
            print("\nRESULT: DEPLOYMENT SUCCESSFUL. Changes are live.")
            
    except Exception as e:
        print(f"❌ Error during verification: {str(e)}")
    finally:
        driver.quit()

if __name__ == "__main__":
    verify_production()
