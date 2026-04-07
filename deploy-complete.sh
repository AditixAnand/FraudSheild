#!/bin/bash

# FraudShield Auto-Deploy Script
echo "🚀 FraudShield Auto-Deployment Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking system requirements..."

    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js from https://nodejs.org/"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi

    if ! command -v git &> /dev/null; then
        print_error "Git is not installed. Please install Git from https://git-scm.com/"
        exit 1
    fi

    print_success "All requirements met!"
}

# Test the application locally
test_locally() {
    print_status "Testing application locally..."

    # Install dependencies
    npm install
    if [ $? -ne 0 ]; then
        print_error "Failed to install dependencies"
        exit 1
    fi

    # Create environment file
    if [ ! -f .env ]; then
        echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
        echo "NODE_ENV=production" >> .env
        echo "PORT=3000" >> .env
        print_success "Environment file created"
    fi

    # Test build
    timeout 10s npm start &
    PID=$!
    sleep 3

    if kill -0 $PID 2>/dev/null; then
        print_success "Application started successfully!"
        kill $PID
    else
        print_error "Application failed to start"
        exit 1
    fi
}

# Prepare for deployment
prepare_deployment() {
    print_status "Preparing for deployment..."

    # Ensure .env is not committed
    if [ -f .env ]; then
        print_warning ".env file exists - ensure it's in .gitignore"
    fi

    # Check if git remote is set
    if ! git remote get-url origin &> /dev/null; then
        print_warning "Git remote not set. You'll need to:"
        echo "1. Create a GitHub repository at https://github.com/new"
        echo "2. Run: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
        echo "3. Run: git push -u origin main"
    else
        print_success "Git remote is configured"
    fi
}

# Show deployment options
show_deployment_options() {
    echo ""
    echo "🎯 DEPLOYMENT OPTIONS:"
    echo "======================"
    echo ""
    echo "1. 🚀 Render (Recommended - Free & Easy)"
    echo "   - Go to: https://render.com"
    echo "   - Connect your GitHub repo"
    echo "   - Auto-deploys from render.yaml"
    echo "   - Free tier available"
    echo ""
    echo "2. 🚂 Railway"
    echo "   - Go to: https://railway.app"
    echo "   - Connect GitHub repo"
    echo "   - Auto-detects Node.js"
    echo "   - Free tier available"
    echo ""
    echo "3. ▲ Vercel"
    echo "   - Go to: https://vercel.com"
    echo "   - Import GitHub repo"
    echo "   - Great for frontend, works with backend"
    echo ""
    echo "4. 🐙 GitHub Pages (Frontend Only)"
    echo "   - Static hosting for demo"
    echo "   - Limited functionality"
    echo ""
}

# Main execution
main() {
    echo "🚀 FraudShield Deployment Preparation"
    echo "===================================="

    check_requirements
    test_locally
    prepare_deployment

    print_success "✅ Project is ready for deployment!"
    echo ""
    show_deployment_options

    echo "📋 NEXT STEPS:"
    echo "=============="
    echo "1. Create a GitHub repository"
    echo "2. Push your code: git push -u origin main"
    echo "3. Choose a deployment platform above"
    echo "4. Connect your GitHub repo"
    echo "5. Add environment variables:"
    echo "   - JWT_SECRET: (generate random)"
    echo "   - NODE_ENV: production"
    echo "   - PORT: 10000 (for Render)"
    echo ""
    echo "6. Your app will be live! 🎉"
    echo ""
    echo "Demo credentials: admin / admin123"
}

# Run main function
main