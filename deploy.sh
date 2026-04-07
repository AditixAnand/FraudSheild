#!/bin/bash

# FraudShield Quick Deploy Script
echo "🚀 FraudShield Deployment Script"
echo "================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "🔑 Creating environment configuration..."
    echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
    echo "NODE_ENV=production" >> .env
    echo "PORT=3000" >> .env
    echo "✅ Environment file created"
else
    echo "ℹ️  Environment file already exists"
fi

# Build for production (if needed)
echo "🔨 Preparing for production..."

# Test the application
echo "🧪 Testing application..."
timeout 10s npm start &
PID=$!
sleep 5

if kill -0 $PID 2>/dev/null; then
    echo "✅ Application started successfully"
    kill $PID
else
    echo "❌ Application failed to start"
    exit 1
fi

echo ""
echo "🎉 FraudShield is ready for deployment!"
echo ""
echo "📋 Deployment Options:"
echo "1. Render:   https://render.com"
echo "2. Railway:  https://railway.app"
echo "3. Vercel:   https://vercel.com"
echo "4. Docker:   docker build -t fraudshield ."
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"
echo ""
echo "🔗 Your app will be available at the deployment URL provided by your hosting platform"