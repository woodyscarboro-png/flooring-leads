@echo off
setlocal

echo.
echo This will commit and push the current flooring-leads folder to GitHub.
echo Run this ONLY from inside your GitHub-connected flooring-leads folder.
echo.
pause

git status
echo.
git add src/Dashboard.js README_V3_PAGED_STABLE_EDIT.txt README_DESKTOP_EDIT_MATCH.txt README.md package.json package-lock.json public src .env.example
git commit -m "Make top controls fixed and sticky"
git push origin main

echo.
echo Done. Now go to Vercel Deployments and wait for the newest build.
pause
