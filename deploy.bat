@echo off
REM FraudShield Quick Deploy Script for Windows
echo 🚀 FraudShield Deployment Script
echo =================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ Node.js and npm are installed

REM Install dependencies
echo 📦 Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully

REM Create .env file if it doesn't exist
if not exist .env (
    echo 🔑 Creating environment configuration...
    REM Generate random JWT secret
    powershell -Command "$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_}); echo JWT_SECRET=$jwtSecret" > .env
    echo NODE_ENV=production>> .env
    echo PORT=3000>> .env
    echo ✅ Environment file created
) else (
    echo ℹ️  Environment file already exists
)

REM Build for production (if needed)
echo 🔨 Preparing for production...

REM Test the application
echo 🧪 Testing application...
start /B npm start >nul 2>&1
timeout /t 5 /nobreak >nul
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if %errorlevel% equ 0 (
    echo ✅ Application started successfully
    taskkill /F /IM node.exe >nul 2>&1
) else (
    echo ❌ Application failed to start
    pause
    exit /b 1
)

echo.
echo 🎉 FraudShield is ready for deployment!
echo.
echo 📋 Deployment Options:
echo 1. Render:   https://render.com
echo 2. Railway:  https://railway.app
echo 3. Vercel:   https://vercel.com
echo 4. Docker:   docker build -t fraudshield .
echo.
echo 📖 See DEPLOYMENT.md for detailed instructions
echo.
echo 🔗 Your app will be available at the deployment URL provided by your hosting platform
echo.
pause