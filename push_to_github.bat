@echo off
cd /d "C:\Users\joyal\.gemini\antigravity\scratch\fnm-app"
echo Pushing FNM to GitHub...
git branch -M main
git push -u origin main
echo.
echo Done! You can now deploy on Vercel.
pause
