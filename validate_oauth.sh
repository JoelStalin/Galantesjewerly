#!/usr/bin/env bash
# Galante's Jewelry - Google OAuth Quick Validation Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Galante's Jewelry - Google OAuth Validation Script      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

# Check 1: .env.local exists
echo -e "\n${BLUE}[1/6]${NC} Checking .env.local file..."
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✓${NC} .env.local exists"
else
    echo -e "${RED}✗${NC} .env.local not found"
    exit 1
fi

# Check 2: Required env variables
echo -e "\n${BLUE}[2/6]${NC} Checking required environment variables..."
source .env.local

required_vars=("GOOGLE_OAUTH_CLIENT_ID" "GOOGLE_OAUTH_CLIENT_SECRET" "GOOGLE_OAUTH_REDIRECT_URI" "GOOGLE_SESSION_SECRET")
all_good=true

for var in "${required_vars[@]}"; do
    value=$(eval echo \$$var)
    if [ -z "$value" ]; then
        echo -e "${RED}✗${NC} $var is not set"
        all_good=false
    elif [ "$value" = "your_client_id.apps.googleusercontent.com" ] || [ "$value" = "your_client_secret" ]; then
        echo -e "${YELLOW}⚠${NC}  $var still has placeholder value: '$value'"
        all_good=false
    else
        echo -e "${GREEN}✓${NC} $var configured"
    fi
done

if [ "$all_good" = false ]; then
    echo -e "\n${YELLOW}⚠  Please update .env.local with real Google credentials${NC}"
    echo -e "   See GOOGLE_OAUTH_FIXES.md for instructions"
fi

# Check 3: Files exist
echo -e "\n${BLUE}[3/6]${NC} Checking key files..."
files_to_check=(
    "app/api/auth/google/callback/route.ts"
    "app/api/auth/google/start/route.ts"
    "lib/google-login.ts"
    "lib/google-oauth.ts"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file exists"
    else
        echo -e "${RED}✗${NC} $file not found"
    fi
done

# Check 4: Logging present
echo -e "\n${BLUE}[4/6]${NC} Checking logging in callback handler..."
if grep -q "\[Google OAuth\]" "app/api/auth/google/callback/route.ts"; then
    log_count=$(grep -c "\[Google OAuth\]" "app/api/auth/google/callback/route.ts")
    echo -e "${GREEN}✓${NC} Found $log_count log statements in callback handler"
else
    echo -e "${RED}✗${NC} No logging found in callback handler"
fi

# Check 5: Test file
echo -e "\n${BLUE}[5/6]${NC} Checking test suite..."
if [ -f "tests/e2e/oauth_test.py" ]; then
    echo -e "${GREEN}✓${NC} OAuth test suite exists"
else
    echo -e "${RED}✗${NC} OAuth test suite not found"
fi

# Check 6: Node.js and npm
echo -e "\n${BLUE}[6/6]${NC} Checking Node.js and npm..."
if command -v node &> /dev/null; then
    node_version=$(node -v)
    echo -e "${GREEN}✓${NC} Node.js $node_version installed"
else
    echo -e "${RED}✗${NC} Node.js not found"
    exit 1
fi

if command -v npm &> /dev/null; then
    npm_version=$(npm -v)
    echo -e "${GREEN}✓${NC} npm $npm_version installed"
else
    echo -e "${RED}✗${NC} npm not found"
    exit 1
fi

# Summary
echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Validation complete!${NC}"
echo -e "\n${BLUE}Next steps:${NC}"
echo -e "  1. Update .env.local with real Google OAuth credentials"
echo -e "  2. Run: npm install"
echo -e "  3. Run: npm run dev"
echo -e "  4. Run: python tests/e2e/oauth_test.py"
echo -e "\n${BLUE}For detailed instructions, see: GOOGLE_OAUTH_FIXES.md${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}\n"
