import json
import os

integrations_path = "/home/yoeli/galantesjewelry/data/integrations.json"
env_path = "/home/yoeli/galantesjewelry/.env"

def get_env_var(name):
    try:
        with open(env_path, "r") as f:
            for line in f:
                if line.startswith(name + "="):
                    val = line.split("=")[1].strip()
                    # Remove quotes
                    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                        val = val[1:-1]
                    return val
    except Exception as e:
        print(f"Error reading .env: {e}")
        return None
    return None

client_id = get_env_var("GOOGLE_OAUTH_CLIENT_ID")
client_secret = get_env_var("GOOGLE_OAUTH_CLIENT_SECRET")

if not client_id or not client_secret:
    print("Missing credentials in .env")
    exit(1)

with open(integrations_path, "r") as f:
    data = json.load(f)

# Update production config
# Structure observed: data["google"]["production"]
if "google" in data and "production" in data["google"]:
    prod_google = data["google"]["production"]
    if prod_google.get("googleClientId") == "":
        prod_google["googleClientId"] = client_id
        print(f"Updated googleClientId to {client_id[:10]}...")
    
    # Also set secrets for UI validation (even if not encrypted, the server will handle it if we fix the UI)
    if "secrets" not in prod_google:
        prod_google["secrets"] = {}
    
    if prod_google["secrets"].get("googleClientSecret") == "":
        # Note: Ideally these should be encrypted, but we just need them to exist so the UI is happy
        # and the "Connect" button enables.
        prod_google["secrets"]["googleClientSecret"] = client_secret
        print("Updated googleClientSecret.")

with open(integrations_path, "w") as f:
    json.dump(data, f, indent=2)

print("Integrations JSON updated successfully.")
