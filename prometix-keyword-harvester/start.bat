@echo off
setlocal
cd /d "%~dp0"

echo Prometix Keyword Harvester
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nije pronadjen. Instaliraj Node.js 18 ili noviji: https://nodejs.org
  pause
  exit /b 1
)

set /p KEYWORD=Unesi keyword (npr. protein u prahu):
if "%KEYWORD%"=="" (
  echo Keyword nije unet.
  pause
  exit /b 1
)

echo.
set /p DEPTH=Dubina [1 ili 2, Enter = 1]:
if "%DEPTH%"=="" set DEPTH=1

echo.
node prometix-keyword-harvester.js "%KEYWORD%" --depth=%DEPTH%

echo.
pause
