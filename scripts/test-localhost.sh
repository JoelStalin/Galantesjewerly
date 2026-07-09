#!/bin/bash
# Functional Testing Script — Galante's Jewelry Localhost
# Tests backend and frontend functionality
# Usage: bash scripts/test-localhost.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_COMPOSE_FILE="docker-compose.production.yml"
NEXT_JS_URL="http://localhost:3000"
NGINX_URL="http://localhost:8080"
ODOO_URL="http://localhost:8069"
MAX_RETRIES=60
RETRY_INTERVAL=1

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker Desktop."
        exit 1
    fi
    log_success "Docker installed"

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose not found."
        exit 1
    fi
    log_success "Docker Compose installed"

    if ! docker ps &> /dev/null; then
        log_error "Docker daemon not running. Please start Docker Desktop."
        exit 1
    fi
    log_success "Docker daemon running"
}

# Start services
start_services() {
    log_info "Starting services with docker-compose..."

    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps | grep -q "galantes_web"; then
        log_warning "Services already running. Restarting..."
        docker-compose -f "$DOCKER_COMPOSE_FILE" down
    fi

    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d --build
    log_success "Services started (building images...)"
}

# Wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local retries=0

    log_info "Waiting for $service_name to be ready..."

    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            log_success "$service_name is ready"
            return 0
        fi

        retries=$((retries + 1))
        if [ $((retries % 10)) -eq 0 ]; then
            log_warning "Still waiting for $service_name... ($retries/$MAX_RETRIES)"
        fi

        sleep $RETRY_INTERVAL
    done

    log_error "$service_name did not respond in time"
    return 1
}

# Check service health
check_service_health() {
    log_info "Checking service health..."

    echo ""
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    echo ""

    local all_healthy=true

    docker-compose -f "$DOCKER_COMPOSE_FILE" ps --format "table {{.Service}}\t{{.Status}}" | while read -r line; do
        if [[ "$line" == *"unhealthy"* ]] || [[ "$line" == *"Exited"* ]]; then
            log_error "Unhealthy service: $line"
            all_healthy=false
        fi
    done
}

# Test endpoints
test_endpoints() {
    log_info "Testing endpoints..."

    # Test Next.js health
    if curl -sf "$NEXT_JS_URL/api/health" > /dev/null 2>&1; then
        log_success "Next.js health check: OK"
    else
        log_error "Next.js health check: FAILED"
    fi

    # Test Nginx health
    if curl -sf "$NGINX_URL/healthz" > /dev/null 2>&1; then
        log_success "Nginx health check: OK"
    else
        log_error "Nginx health check: FAILED"
    fi

    # Test Odoo
    if curl -sf "$ODOO_URL" > /dev/null 2>&1; then
        log_success "Odoo responds: OK"
    else
        log_error "Odoo responds: FAILED"
    fi
}

# Test frontend pages
test_frontend_pages() {
    log_info "Testing frontend pages..."

    local pages=("/" "/collections" "/bridal" "/about" "/contact" "/shop" "/admin/login")

    for page in "${pages[@]}"; do
        local url="$NGINX_URL$page"
        local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")

        if [ "$http_code" = "200" ] || [ "$http_code" = "301" ] || [ "$http_code" = "302" ]; then
            log_success "Page $page: HTTP $http_code"
        else
            log_warning "Page $page: HTTP $http_code (unexpected)"
        fi
    done
}

# Test Odoo admin
test_odoo_admin() {
    log_info "Testing Odoo admin panel..."

    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$ODOO_URL/web/login")

    if [ "$http_code" = "200" ]; then
        log_success "Odoo login page: HTTP $http_code"
    else
        log_warning "Odoo login page: HTTP $http_code"
    fi
}

# Test API endpoints
test_api_endpoints() {
    log_info "Testing API endpoints..."

    # Test Odoo client endpoint (may not exist yet)
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$NEXT_JS_URL/api/products")

    if [ "$http_code" = "200" ]; then
        log_success "Odoo client API (/api/products): HTTP $http_code"
    else
        log_warning "Odoo client API (/api/products): HTTP $http_code (expected — not yet implemented)"
    fi

    # Test Meta sync endpoint (should require auth)
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$NEXT_JS_URL/api/integrations/meta/sync" \
        -H "Authorization: Bearer invalid-token" \
        -H "Content-Type: application/json" \
        -d '{"dryRun": true}')

    if [ "$http_code" = "401" ]; then
        log_success "Meta sync endpoint (auth protected): HTTP $http_code (correct)"
    else
        log_warning "Meta sync endpoint: HTTP $http_code"
    fi
}

# Display test summary
test_summary() {
    log_info "Test Summary"
    echo ""
    echo "📍 Access Points:"
    echo "  • Editorial Site: $NGINX_URL"
    echo "  • Shop: $NGINX_URL/shop"
    echo "  • Odoo Admin: $ODOO_URL"
    echo "  • Next.js Direct: $NEXT_JS_URL"
    echo ""
    echo "🔧 Useful Commands:"
    echo "  • View logs: docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
    echo "  • Restart: docker-compose -f $DOCKER_COMPOSE_FILE restart"
    echo "  • Stop: docker-compose -f $DOCKER_COMPOSE_FILE down"
    echo "  • Clean: docker-compose -f $DOCKER_COMPOSE_FILE down -v"
    echo ""
    echo "📖 Documentation:"
    echo "  • Testing Guide: TESTING.md"
    echo "  • Deployment Notes: docs/deployment-notes.md"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "╔════════════════════════════════════════════╗"
    echo "║ Galante's Jewelry - Localhost Testing 🧪  ║"
    echo "╚════════════════════════════════════════════╝"
    echo ""

    check_prerequisites
    echo ""

    start_services
    echo ""

    # Wait for services to become healthy
    log_info "Waiting for services to initialize (this may take 1–2 minutes)..."
    wait_for_service "$NEXT_JS_URL/api/health" "Next.js"
    wait_for_service "$ODOO_URL" "Odoo"
    echo ""

    check_service_health
    echo ""

    test_endpoints
    echo ""

    test_frontend_pages
    echo ""

    test_odoo_admin
    echo ""

    test_api_endpoints
    echo ""

    test_summary

    log_success "Testing complete! 🎉"
}

# Run main
main
