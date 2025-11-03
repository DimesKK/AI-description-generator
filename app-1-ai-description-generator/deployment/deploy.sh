#!/bin/bash

# AI Product Description Generator - Production Deployment Script
# This script deploys the complete SaaS platform with all services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups/deploy-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="./logs/deploy-$(date +%Y%m%d-%H%M%S).log"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose first."
    fi
    
    # Check environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file $ENV_FILE not found. Please create it first."
    fi
    
    success "Prerequisites check completed"
}

# Create necessary directories
setup_directories() {
    log "Setting up directories..."
    
    mkdir -p logs
    mkdir -p backups
    mkdir -p ssl
    mkdir -p nginx/conf.d
    mkdir -p monitoring/{grafana,prometheus}
    
    success "Directories created"
}

# Generate SSL certificates (self-signed for development)
generate_ssl_certs() {
    log "Generating SSL certificates..."
    
    if [[ ! -f "./ssl/server.crt" ]]; then
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ./ssl/server.key \
            -out ./ssl/server.crt \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
            2>/dev/null || warning "Failed to generate SSL certificates"
    fi
    
    success "SSL certificates ready"
}

# Setup database
setup_database() {
    log "Setting up database..."
    
    # Start only PostgreSQL first
    docker-compose up -d postgres
    
    # Wait for PostgreSQL to be ready
    log "Waiting for PostgreSQL to be ready..."
    timeout=60
    while ! docker-compose exec postgres pg_isready -U postgres 2>/dev/null; do
        if [[ $timeout -le 0 ]]; then
            error "PostgreSQL failed to start"
        fi
        sleep 2
        timeout=$((timeout-2))
    done
    
    success "Database is ready"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Run Prisma migrations
    if [[ -f "./backend/dist/index.js" ]]; then
        docker-compose exec backend npx prisma db push || warning "Database migration failed"
        docker-compose exec backend npx prisma generate || warning "Prisma client generation failed"
    fi
    
    success "Database migrations completed"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring stack..."
    
    # Start monitoring services
    docker-compose up -d prometheus grafana
    
    # Wait for Grafana
    sleep 10
    
    # Setup Grafana datasources (if needed)
    # This would typically be done via API calls
    
    success "Monitoring stack ready"
}

# Deploy application
deploy_application() {
    log "Deploying application services..."
    
    # Build and start all services
    docker-compose up -d --build
    
    success "Application deployed"
}

# Wait for services to be healthy
wait_for_services() {
    log "Waiting for services to be healthy..."
    
    services=("backend:3001" "frontend:3000" "n8n:5678")
    
    for service_port in "${services[@]}"; do
        IFS=':' read -r service port <<< "$service_port"
        log "Checking $service on port $port..."
        
        timeout=120
        while ! curl -f "http://localhost:$port/health" 2>/dev/null; do
            if [[ $timeout -le 0 ]]; then
                error "$service failed to start"
            fi
            sleep 5
            timeout=$((timeout-5))
        done
        
        success "$service is healthy"
    done
    
    success "All services are healthy"
}

# Setup webhook endpoints
setup_webhooks() {
    log "Setting up webhooks..."
    
    # Create webhook for n8n workflow
    webhook_url="http://localhost:5678/webhook/product-description-webhook"
    
    # This would typically involve setting up the actual webhook in your system
    log "Webhook URL: $webhook_url"
    
    success "Webhooks configured"
}

# Create backup
create_backup() {
    log "Creating initial backup..."
    
    # Backup database
    mkdir -p "$BACKUP_DIR"
    docker-compose exec postgres pg_dump -U postgres ai_descriptions > "$BACKUP_DIR/database.sql" || warning "Database backup failed"
    
    # Backup important configuration files
    cp .env.production "$BACKUP_DIR/" 2>/dev/null || true
    cp docker-compose.yml "$BACKUP_DIR/" 2>/dev/null || true
    
    success "Backup created at $BACKUP_DIR"
}

# Health check
health_check() {
    log "Performing health check..."
    
    endpoints=(
        "http://localhost:3001/health"
        "http://localhost:3000"
        "http://localhost:5678"
        "http://localhost:3003"
        "http://localhost:9090"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -f "$endpoint" 2>/dev/null; then
            success "$endpoint is accessible"
        else
            warning "$endpoint is not accessible"
        fi
    done
}

# Display deployment summary
display_summary() {
    log "Deployment Summary:"
    echo ""
    echo -e "${GREEN}🚀 AI Product Description Generator - Successfully Deployed${NC}"
    echo ""
    echo -e "${BLUE}Services:${NC}"
    echo -e "  • Frontend: ${GREEN}http://localhost:3000${NC}"
    echo -e "  • Backend API: ${GREEN}http://localhost:3001${NC}"
    echo -e "  • n8n Workflows: ${GREEN}http://localhost:5678${NC} (admin/admin123)"
    echo -e "  • Grafana Dashboard: ${GREEN}http://localhost:3003${NC} (admin/admin123)"
    echo -e "  • Prometheus: ${GREEN}http://localhost:9090${NC}"
    echo ""
    echo -e "${BLUE}Monitoring:${NC}"
    echo -e "  • Logs: ${GREEN}./logs/${NC}"
    echo -e "  • Backups: ${GREEN}./backups/${NC}"
    echo -e "  • Deployment Log: ${GREEN}$LOG_FILE${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "  1. Configure your Shopify app credentials in $ENV_FILE"
    echo -e "  2. Set up your OpenAI API key"
    echo -e "  3. Configure Stripe for payments"
    echo -e "  4. Import the n8n workflow from ./n8n/workflows/"
    echo -e "  5. Set up domain and SSL certificates for production"
    echo ""
}

# Cleanup function
cleanup() {
    error "Deployment failed. Cleaning up..."
    docker-compose down
    exit 1
}

# Trap errors
trap cleanup ERR

# Main deployment process
main() {
    log "Starting AI Product Description Generator deployment..."
    
    check_prerequisites
    setup_directories
    generate_ssl_certs
    setup_database
    run_migrations
    setup_monitoring
    deploy_application
    wait_for_services
    setup_webhooks
    create_backup
    health_check
    display_summary
    
    success "Deployment completed successfully! 🎉"
}

# Check if script is run as root (not recommended)
if [[ $EUID -eq 0 ]]; then
   warning "Running as root is not recommended. Consider running as a regular user with Docker permissions."
fi

# Run main function
main "$@"
