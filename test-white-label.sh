#!/bin/bash
# White-Label System Test Script
# Tests the complete white-label tier system implementation

set -e

echo "=================================================="
echo "White-Label Tier System - Test Suite"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

# Test function
test_case() {
    echo -n "Testing: $1... "
}

pass() {
    echo -e "${GREEN}✓ PASS${NC}"
    ((pass_count++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}"
    echo "  Error: $1"
    ((fail_count++))
}

warn() {
    echo -e "${YELLOW}⚠ WARNING${NC}"
    echo "  $1"
}

echo "1. Backend Files"
echo "----------------"

test_case "Tier enforcement middleware exists"
if [ -f "backend/middleware/tierCheck.js" ]; then
    pass
else
    fail "backend/middleware/tierCheck.js not found"
fi

test_case "Asset storage service exists"
if [ -f "backend/services/assetStorage.js" ]; then
    pass
else
    fail "backend/services/assetStorage.js not found"
fi

test_case "Asset routes exist"
if [ -f "backend/routes/admin/assets.js" ]; then
    pass
else
    fail "backend/routes/admin/assets.js not found"
fi

test_case "Branding routes exist"
if [ -f "backend/routes/admin/branding.js" ]; then
    pass
else
    fail "backend/routes/admin/branding.js not found"
fi

test_case "Email service has branded templates"
if grep -q "getEmailConfig" backend/services/email.js 2>/dev/null; then
    pass
else
    fail "Branded email functions not found in email.js"
fi

echo ""
echo "2. Frontend Files"
echo "----------------"

test_case "White-label tier hook exists"
if [ -f "frontend/src/hooks/useWhiteLabelTier.js" ]; then
    pass
else
    fail "frontend/src/hooks/useWhiteLabelTier.js not found"
fi

test_case "AssetUploader component exists"
if [ -f "frontend/src/components/branding/AssetUploader.jsx" ]; then
    pass
else
    fail "AssetUploader component not found"
fi

test_case "ColorPicker component exists"
if [ -f "frontend/src/components/branding/ColorPicker.jsx" ]; then
    pass
else
    fail "ColorPicker component not found"
fi

test_case "ColorPaletteEditor component exists"
if [ -f "frontend/src/components/branding/ColorPaletteEditor.jsx" ]; then
    pass
else
    fail "ColorPaletteEditor component not found"
fi

test_case "CSSEditor component exists"
if [ -f "frontend/src/components/branding/CSSEditor.jsx" ]; then
    pass
else
    fail "CSSEditor component not found"
fi

test_case "Enhanced Branding page exists"
if [ -f "frontend/src/pages/Branding.jsx" ]; then
    if grep -q "ColorPaletteEditor" frontend/src/pages/Branding.jsx 2>/dev/null; then
        pass
    else
        warn "Branding page exists but may not have Enterprise features"
    fi
else
    fail "Branding page not found"
fi

test_case "AgencyContext has CSS injection"
if grep -q "agency-custom-css" frontend/src/context/AgencyContext.jsx 2>/dev/null; then
    pass
else
    fail "CSS injection not found in AgencyContext"
fi

echo ""
echo "3. Database"
echo "----------------"

test_case "Migration file exists"
if [ -f "database/migrations/012_white_label_tiers.sql" ]; then
    pass
else
    fail "Migration 012 not found"
fi

test_case "Migration has tier columns"
if grep -q "white_label_tier" database/migrations/012_white_label_tiers.sql 2>/dev/null; then
    pass
else
    fail "white_label_tier column not in migration"
fi

test_case "Migration has custom_domains table"
if grep -q "CREATE TABLE.*custom_domains" database/migrations/012_white_label_tiers.sql 2>/dev/null; then
    pass
else
    fail "custom_domains table not in migration"
fi

test_case "Migration has asset_uploads table"
if grep -q "CREATE TABLE.*asset_uploads" database/migrations/012_white_label_tiers.sql 2>/dev/null; then
    pass
else
    fail "asset_uploads table not in migration"
fi

echo ""
echo "4. Dependencies"
echo "----------------"

test_case "Sharp package installed"
if grep -q "\"sharp\"" frontend/../backend/package.json 2>/dev/null || npm list sharp --prefix backend >/dev/null 2>&1; then
    pass
else
    fail "Sharp package not installed"
fi

test_case "Multer package installed"
if grep -q "\"multer\"" frontend/../backend/package.json 2>/dev/null || npm list multer --prefix backend >/dev/null 2>&1; then
    pass
else
    fail "Multer package not installed"
fi

test_case "Monaco editor installed"
if grep -q "@monaco-editor/react" frontend/package.json 2>/dev/null || npm list @monaco-editor/react --prefix frontend >/dev/null 2>&1; then
    pass
else
    fail "Monaco editor not installed"
fi

echo ""
echo "5. Integration"
echo "----------------"

test_case "Branding routes registered in server"
if grep -q "branding" backend/server.js 2>/dev/null; then
    pass
else
    fail "Branding routes not registered in server.js"
fi

test_case "Assets routes registered in server"
if grep -q "assets" backend/server.js 2>/dev/null; then
    pass
else
    fail "Assets routes not registered in server.js"
fi

test_case "Sidebar has PoweredBy footer"
if grep -q "PoweredByFooter\|shouldHidePoweredBy" frontend/src/components/layout/Sidebar.jsx 2>/dev/null; then
    pass
else
    warn "Sidebar may not have PoweredBy footer with white-label support"
fi

test_case "Login page supports custom background"
if grep -q "login_background" frontend/src/pages/Login.jsx 2>/dev/null; then
    pass
else
    warn "Login page may not support custom backgrounds"
fi

echo ""
echo "=================================================="
echo "Test Summary"
echo "=================================================="
echo -e "${GREEN}Passed: $pass_count${NC}"
if [ $fail_count -gt 0 ]; then
    echo -e "${RED}Failed: $fail_count${NC}"
fi
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}✓ All critical tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Apply database migration in Supabase SQL Editor"
    echo "2. Create 'agency-assets' storage bucket (public)"
    echo "3. Start backend: cd backend && npm start"
    echo "4. Start frontend: cd frontend && npm run dev"
    echo "5. Navigate to /admin/branding to test"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the errors above.${NC}"
    echo ""
    exit 1
fi
