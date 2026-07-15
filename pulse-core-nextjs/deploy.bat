@echo off
echo ==============================================================
echo AfyaHero Production Deployment Utility
echo ==============================================================
echo.
echo 1. Initializing Git Repository...
git init
echo.
echo 2. Adding files...
git add .
echo.
echo 3. Creating Initial Commit...
git commit -m "Production readiness: Live data integration, AES-256 security, and Gemini AI"
echo.
echo 4. Adding Remote...
git remote add origin https://github.com/AfyaVerse-stack/Digihealth-system-
echo.
echo 5. Pushing to GitHub...
git branch -M main
git push -u origin main
echo.
echo ==============================================================
echo Deployment Attempt Complete. 
echo Ensure you have Git installed and in your PATH.
echo ==============================================================
pause
