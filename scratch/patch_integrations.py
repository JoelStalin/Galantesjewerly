import json
import os

path = "/home/yoeli/galantesjewelry/data/integrations.json"
if not os.path.exists(path):
    print(f"Error: {path} not found")
    exit(1)

with open(path, "r") as f:
    data = json.load(f)

# Update production appointment config
prod_config = data.get("appointmentConfigs", {}).get("production", {})
if prod_config:
    prod_config["googleCalendarId"] = "primary"
    prod_config["gmailRecipientInbox"] = "ceo@galantesjewelry.com"
    prod_config["gmailSender"] = "joelstalin2105@gmail.com"
    prod_config["appointmentTimezone"] = "America/New_York"
    print("Updated production appointment parameters.")

with open(path, "w") as f:
    json.dump(data, f, indent=2)

print("Integrations successfully patched.")
