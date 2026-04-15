#!/bin/bash
# api_setup.sh
# Create a Cloudflare Tunnel programmatically via API (requires jq)

set -e

API_TOKEN=${CF_API_TOKEN}
ACCOUNT_ID=${CF_ACCOUNT_ID}
TUNNEL_NAME="galantes_tunnel"

if [ -z "$API_TOKEN" ] || [ -z "$ACCOUNT_ID" ]; then
    echo "Please set CF_API_TOKEN and CF_ACCOUNT_ID environment variables."
    exit 1
fi

echo "Creating Cloudflare Tunnel: $TUNNEL_NAME..."

curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel" \
     -H "Authorization: Bearer $API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"name":"'"$TUNNEL_NAME"'", "tunnel_secret": "GENERATED_OR_PASSED_SECRET"}' > tunnel_response.json

echo "Response saved to tunnel_response.json"
echo "Check the dashboard to assign public hostnames."
