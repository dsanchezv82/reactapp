#!/bin/bash

echo "🔐 Step 1: Authenticating with SurfSight..."
AUTH_RESPONSE=$(curl -s -X POST https://api-prod.surfsight.net/v2/authenticate \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@garditech.com","password":"80T5jNpC9Bq8daTB"}')

echo "Response: $AUTH_RESPONSE"

# Extract token using grep and sed (works without jq)
TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"token":"[^"]*"' | sed 's/"token":"\([^"]*\)"/\1/')

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get auth token"
  exit 1
fi

echo "✅ Got SurfSight partner token: ${TOKEN:0:30}..."

echo ""
echo "⏰ Step 2: Calling wake-up API for IMEI 865509052362369..."
WAKEUP_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  https://api-prod.surfsight.net/v2/devices/865509052362369/wakeup \
  -H "Authorization: Bearer $TOKEN")

echo "$WAKEUP_RESPONSE"
echo ""
echo "✅ Test complete!"
