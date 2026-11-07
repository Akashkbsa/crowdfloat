@echo off
setlocal

set "BASE_DIR=%~dp0"
set "BACKEND_DIR=%BASE_DIR%backend"
set "FRONTEND_DIR=%BASE_DIR%crowdfloat-react"

echo ========================================
echo   CrowdFloat Full Stack Starter
echo ========================================

echo [1/4] Installing backend dependencies...
cd /d "%BACKEND_DIR%"
python -m pip install -r requirements.txt
if errorlevel 1 (
  echo Backend dependency install failed.
  pause
  exit /b 1
)

echo [2/4] Seeding databases if missing...
if not exist "%BACKEND_DIR%\crowdfloat.db" (
  python generate_main_db.py
)
if not exist "%BACKEND_DIR%\buyer_financials.db" (
  python generate_buyer_db.py
)

echo [3/4] Installing frontend dependencies if needed...
if not exist "%FRONTEND_DIR%\node_modules" (
  cd /d "%FRONTEND_DIR%"
  call npm install
  if errorlevel 1 (
    echo Frontend dependency install failed.
    pause
    exit /b 1
  )
)

echo [4/4] Starting services...
start "CrowdFloat Backend" cmd /k "cd /d %BACKEND_DIR% && python main.py"
timeout /t 2 /nobreak >nul
start "CrowdFloat Frontend" cmd /k "cd /d %FRONTEND_DIR% && npm run dev -- --port 5173 --strictPort"

echo.
echo Done. Open:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8001/health
echo.
