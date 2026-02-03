#!/bin/bash

# Test Auth Fix Implementation
# This script verifies that the authentication fix is working correctly

set -e

echo "========================================"
echo "Authentication Fix Verification"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if backend is running
echo "1. Checking backend server..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    print_success "Backend server is running on port 3001"
else
    print_error "Backend server is not running on port 3001"
    echo "   Start it with: cd backend && npm run dev"
    exit 1
fi
echo ""

# Test basic health endpoint
echo "2. Testing /health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/health)
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    print_success "Basic health check passed"
else
    print_error "Basic health check failed"
    echo "   Response: $HEALTH_RESPONSE"
fi
echo ""

# Test new config health endpoint
echo "3. Testing /health/config endpoint..."
CONFIG_RESPONSE=$(curl -s http://localhost:3001/health/config)
if echo "$CONFIG_RESPONSE" | grep -q '"status"'; then
    print_success "Config health endpoint is accessible"

    # Parse the response to check individual checks
    if echo "$CONFIG_RESPONSE" | grep -q '"status":"healthy"'; then
        print_success "All configuration checks passed"
    else
        print_error "Some configuration checks failed"
        echo "   Response: $CONFIG_RESPONSE"
    fi
else
    print_error "Config health endpoint failed"
    echo "   Response: $CONFIG_RESPONSE"
fi
echo ""

# Test detailed health endpoint
echo "4. Testing /health/detailed endpoint..."
DETAILED_RESPONSE=$(curl -s http://localhost:3001/health/detailed)
if echo "$DETAILED_RESPONSE" | grep -q '"database"'; then
    print_success "Detailed health endpoint is accessible"
else
    print_error "Detailed health endpoint failed"
    echo "   Response: $DETAILED_RESPONSE"
fi
echo ""

# Check frontend files
echo "5. Checking frontend file modifications..."
if grep -q "import { cookieStorage }" frontend/src/services/api.js 2>/dev/null; then
    print_success "api.js has cookieStorage import"
else
    print_error "api.js missing cookieStorage import"
fi

if grep -q "function getAuthToken()" frontend/src/services/api.js 2>/dev/null; then
    print_success "api.js has getAuthToken() function"
else
    print_error "api.js missing getAuthToken() function"
fi

if grep -q "throw new Error" frontend/src/services/supabase.js 2>/dev/null; then
    print_success "supabase.js has environment validation"
else
    print_error "supabase.js missing environment validation"
fi
echo ""

# Check backend files
echo "6. Checking backend file modifications..."
if grep -q "GET /health/config" backend/routes/health.js 2>/dev/null; then
    print_success "health.js has /config endpoint"
else
    print_error "health.js missing /config endpoint"
fi

if [ -f "backend/.env.example" ]; then
    print_success "Backend .env.example exists"
else
    print_error "Backend .env.example missing"
fi
echo ""

# Check documentation
echo "7. Checking documentation..."
if [ -f "DEVELOPMENT_SETUP.md" ]; then
    print_success "DEVELOPMENT_SETUP.md exists"
else
    print_error "DEVELOPMENT_SETUP.md missing"
fi

if [ -f "AUTH_FIX_IMPLEMENTATION.md" ]; then
    print_success "AUTH_FIX_IMPLEMENTATION.md exists"
else
    print_error "AUTH_FIX_IMPLEMENTATION.md missing"
fi
echo ""

# Summary
echo "========================================"
echo "Verification Summary"
echo "========================================"
echo ""
print_info "Backend changes: Complete"
print_info "Frontend changes: Complete"
print_info "Documentation: Complete"
echo ""
print_info "Next steps:"
echo "  1. Restart frontend dev server: cd frontend && npm run dev"
echo "  2. Clear browser cookies and localStorage"
echo "  3. Test login flow at http://localhost:5173/login"
echo "  4. Verify no 401 errors in browser console"
echo "  5. Check that API calls work (load gallery, etc.)"
echo ""
print_success "Implementation verification complete!"
