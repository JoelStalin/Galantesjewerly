import base64
import json

account_id = "efce4179a7ee96c19b43c42bced58587"
tunnel_id = "d0fec6c7-0b8e-4ede-839d-af9d22fa711d"
tunnel_secret = "YmM5NTYxOGQtNDY1ZS00NWNlTThjZTI0YTBhMWZmZjBjZBhODVkYmI="

token_data = {
    "a": account_id,
    "t": tunnel_id,
    "s": tunnel_secret
}

token_json = json.dumps(token_data)
token_b64 = base64.b64encode(token_json.encode()).decode()

print(token_b64)
