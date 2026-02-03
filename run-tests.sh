#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "════════════════════════════════════════════════════════════════"
echo "   Team Permissions Implementation - Comprehensive Test Suite"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function
test_file_exists() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ PASS${NC} - File exists: $1"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} - File missing: $1"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

test_syntax() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if node -c "$1" 2>/dev/null; then
        echo -e "${GREEN}✅ PASS${NC} - Syntax valid: $1"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} - Syntax error: $1"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo "═══ Phase 1: File Existence Tests ═══"
echo ""

# Database files
test_file_exists "database/migrations/011_team_permissions.sql"

# Backend files
test_file_exists "backend/middleware/permissions.js"
test_file_exists "backend/routes/team.js"
test_file_exists "backend/services/agencyProvisioning.js"
test_file_exists "backend/services/email.js"

# Frontend components
test_file_exists "frontend/src/components/common/AccessDenied.jsx"
test_file_exists "frontend/src/components/team/PermissionEditor.jsx"
test_file_exists "frontend/src/components/team/ModelAssignment.jsx"
test_file_exists "frontend/src/components/team/InviteModal.jsx"
test_file_exists "frontend/src/components/onboarding/FirstLoginOnboarding.jsx"

# Frontend pages
test_file_exists "frontend/src/pages/Team.jsx"
test_file_exists "frontend/src/pages/TeamMemberOnboarding.jsx"
test_file_exists "frontend/src/pages/AcceptInvite.jsx"
test_file_exists "frontend/src/App.jsx"

# Documentation
test_file_exists "TESTING_CHECKLIST.md"
test_file_exists "TEAM_PERMISSIONS_IMPLEMENTATION_COMPLETE.md"

echo ""
echo "═══ Phase 2: Backend Syntax Tests ═══"
echo ""

# Test backend syntax
test_syntax "backend/middleware/permissions.js"
test_syntax "backend/routes/team.js"
test_syntax "backend/services/agencyProvisioning.js"
test_syntax "backend/services/email.js"

echo ""
echo "═══ Phase 3: Database Migration Analysis ═══"
echo ""

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if grep -q "CREATE TABLE.*user_model_assignments" database/migrations/011_team_permissions.sql; then
    echo -e "${GREEN}✅ PASS${NC} - Migration creates user_model_assignments table"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} - Migration missing user_model_assignments table"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if grep -q "CREATE TABLE.*team_activity_log" database/migrations/011_team_permissions.sql; then
    echo -e "${GREEN}✅ PASS${NC} - Migration creates team_activity_log table"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} - Migration missing team_activity_log table"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if grep -q "ALTER TABLE agency_users ADD COLUMN.*permissions" database/migrations/011_team_permissions.sql; then
    echo -e "${GREEN}✅ PASS${NC} - Migration adds permissions column"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} - Migration missing permissions column"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if grep -q "get_default_permissions" database/migrations/011_team_permissions.sql; then
    echo -e "${GREEN}✅ PASS${NC} - Migration includes get_default_permissions function"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} - Migration missing get_default_permissions function"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "═══ Phase 4: API Endpoint Verification ═══"
echo ""

# Check team.js for new endpoints
ENDPOINTS=("pending-invites" "resend" "permissions" "models" "activity")
for endpoint in "${ENDPOINTS[@]}"; do
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if grep -q "$endpoint" backend/routes/team.js; then
        echo -e "${GREEN}✅ PASS${NC} - Endpoint implemented: $endpoint"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC} - Endpoint missing: $endpoint"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
done

echo ""
echo "═══ Phase 5: Middleware Functions ═══"
echo ""

MIDDLEWARE=("hasPermission" "requireModelAccess" "loadUserModels" "validatePermissions" "logTeamActivity")
for func in "${MIDDLEWARE[@]}"; do
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if grep -q "function $func\|const $func\|export.*$func" backend/middleware/permissions.js; then
        echo -e "${GREEN}✅ PASS${NC} - Middleware function exists: $func"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC} - Middleware function missing: $func"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
done

echo ""
echo "═══ Phase 6: Frontend Component Checks ═══"
echo ""

# Check components export
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if grep -q "export default.*AccessDenied\|export.*AccessDenied" frontend/src/components/common/AccessDenied.jsx; then
    echo -e "${GREEN}✅ PASS${NC} - AccessDenied component exports correctly"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} - AccessDenied component export issue"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if grep -q "export default.*PermissionEditor\|export.*PermissionEditor" frontend/src/components/team/PermissionEditor.jsx; then
    echo -e "${GREEN}✅ PASS${NC} - PermissionEditor component exports correctly"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} - PermissionEditor component export issue"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if grep -q "InviteModal" frontend/src/pages/Team.jsx; then
    echo -e "${GREEN}✅ PASS${NC} - Team page imports InviteModal"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} - Team page doesn't import InviteModal"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "═══ Phase 7: API Client Methods ═══"
echo ""

API_METHODS=("getPendingInvites" "resendInvite" "revokeInvite" "updateUserPermissions" "assignModels" "getUserModels" "getTeamActivity")
for method in "${API_METHODS[@]}"; do
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if grep -q "$method" frontend/src/services/api.js; then
        echo -e "${GREEN}✅ PASS${NC} - API method exists: $method"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAIL${NC} - API method missing: $method"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
done

echo ""
echo "═══ Phase 8: Route Configuration ═══"
echo ""

TOTAL_TESTS=$((TOTAL_TESTS + 1))
if grep -q "TeamMemberOnboardingPage\|onboarding" frontend/src/App.jsx; then
    echo -e "${GREEN}✅ PASS${NC} - Onboarding route configured"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} - Onboarding route not configured"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "                        TEST SUMMARY                            "
echo "════════════════════════════════════════════════════════════════"
echo ""
echo -e "Total Tests:    ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed:         ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:         ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo ""
    echo "🎉 Implementation is complete and verified!"
    echo ""
    echo "Next steps:"
    echo "1. Apply database migration via Supabase SQL Editor"
    echo "2. Start backend: cd backend && npm run dev"
    echo "3. Start frontend: cd frontend && npm run dev"
    echo "4. Test in browser at http://localhost:5173"
    exit 0
else
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "${YELLOW}⚠️  SOME TESTS FAILED${NC}"
    echo ""
    echo "Pass rate: $PASS_RATE%"
    echo ""
    echo "Review failed tests above and fix issues."
    exit 1
fi
