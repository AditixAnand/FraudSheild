@echo off
REM FraudShield Instant Deploy Script
echo 🚀 FraudShield - Instant Deployment
echo ====================================

echo [1/3] Checking project status...
cd "c:\Users\91799\Downloads\fraud-detector\fraud-detector"
if not exist package.json (
    echo [ERROR] package.json not found!
    pause
    exit /b 1
)
echo [SUCCESS] Project found!

echo.
echo [2/3] Preparing deployment package...
REM Create deployment zip
powershell -Command "Compress-Archive -Path * -DestinationPath ..\fraudshield-deploy.zip -Force" 2>nul
echo [SUCCESS] Deployment package created!

echo.
echo [3/3] Choose your deployment platform:
echo =====================================
echo.
echo 🚀 FASTEST OPTION - Railway (2 minutes):
echo 1. Go to: https://railway.app/new
echo 2. Click "Deploy from GitHub repo"
echo 3. Connect your GitHub repo (fraudshield)
echo 4. Railway auto-deploys instantly!
echo.
echo 📦 ALTERNATIVE - Render (3 minutes):
echo 1. Go to: https://render.com
echo 2. Click "New +" → "Web Service"
echo 3. Connect GitHub repo
echo 4. Auto-configures from render.yaml
echo.
echo ⚡ QUICKEST - Vercel (1 minute):
echo 1. Go to: https://vercel.com/new
echo 2. Import GitHub repo
echo 3. Deploy instantly
echo.
echo 📋 REQUIRED: Create GitHub repo first:
echo git remote add origin https://github.com/YOUR_USERNAME/fraudshield.git
echo git push -u origin main
echo.
echo 🎯 Your app will be live at: https://your-app-name.platform.com
echo Login: admin / admin123
echo.
pause