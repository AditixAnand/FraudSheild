@echo off
REM FraudShield Windows Deployment Script
echo 🚀 FraudShield Deployment Preparation
echo =====================================

echo [INFO] Checking system requirements...

REM Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install from https://nodejs.org/
    pause
    exit /b 1
)

REM Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed.
    pause
    exit /b 1
)

REM Check git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed. Please install from https://git-scm.com/
    pause
    exit /b 1
)

echo [SUCCESS] All requirements met!

echo [INFO] Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)

echo [SUCCESS] Dependencies installed!

REM Create environment file if it doesn't exist
if not exist .env (
    echo [INFO] Creating environment file...
    echo JWT_SECRET=%random%%random%%random%%random%> .env
    echo NODE_ENV=production>> .env
    echo PORT=3000>> .env
    echo [SUCCESS] Environment file created
) else (
    echo [INFO] Environment file already exists
)

echo [INFO] Testing application startup...
timeout /t 5 /nobreak >nul 2>&1
start /b node server.js
timeout /t 3 /nobreak >nul 2>&1
tasklist /fi "imagename eq node.exe" | find "node.exe" >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Application started successfully!
    taskkill /f /im node.exe >nul 2>&1
) else (
    echo [ERROR] Application failed to start
    pause
    exit /b 1
)

echo.
echo ✅ PROJECT IS READY FOR DEPLOYMENT!
echo.
echo 🎯 DEPLOYMENT OPTIONS:
echo ======================
echo.
echo 1. 🚀 Render (Recommended - Free and Easy)
echo    - Go to: https://render.com
echo    - Sign up/Login
echo    - Click "New +" → "Web Service"
echo    - Connect your GitHub repository
echo    - Service will auto-configure from render.yaml
echo    - Add environment variables:
echo      • JWT_SECRET: (generate random)
echo      • NODE_ENV: production
echo      • PORT: 10000
echo.
echo 2. 🚂 Railway (Alternative)
echo    - Go to: https://railway.app
echo    - Connect GitHub repo
echo    - Auto-detects Node.js
echo.
echo 3. ▲ Vercel
echo    - Go to: https://vercel.com
echo    - Import GitHub repo
echo.
echo 📋 NEXT STEPS:
echo ==============
echo 1. Create GitHub repository at: https://github.com/new
echo 2. Set remote: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
echo 3. Push code: git push -u origin main
echo 4. Choose deployment platform above
echo 5. Connect GitHub repo and deploy
echo.
echo 🎉 Your FraudShield will be live!
echo Demo login: admin / admin123
echo.
pause