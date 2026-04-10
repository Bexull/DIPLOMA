@echo off
REM ============================================
REM  Network IDS - запуск на Windows
REM ============================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   Network IDS - Система обнаружения атак
echo ============================================
echo.

REM ---------- Проверка Python ----------
where python >nul 2>nul
if errorlevel 1 (
    echo [ОШИБКА] Python не найден. Установи Python 3.11+ с https://www.python.org/downloads/
    echo При установке поставь галочку "Add Python to PATH".
    pause
    exit /b 1
)

REM ---------- Проверка Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
    echo [ОШИБКА] Node.js не найден. Установи Node.js 20+ с https://nodejs.org/
    pause
    exit /b 1
)

REM ---------- Backend: venv + зависимости ----------
if not exist "backend\.venv" (
    echo [1/3] Создаю Python venv и ставлю зависимости...
    cd backend
    python -m venv .venv
    if errorlevel 1 (
        echo [ОШИБКА] Не удалось создать venv.
        pause
        exit /b 1
    )
    call .venv\Scripts\activate.bat
    python -m pip install --upgrade pip -q
    pip install -r requirements-prod.txt -q
    if errorlevel 1 (
        echo [ОШИБКА] Не удалось установить Python-зависимости.
        pause
        exit /b 1
    )
    cd ..
    echo   Готово.
) else (
    echo [1/3] Python-зависимости уже установлены.
)

REM ---------- Frontend: node_modules ----------
if not exist "frontend\node_modules" (
    echo [2/3] Ставлю Frontend-зависимости...
    cd frontend
    call npm install --legacy-peer-deps --silent
    if errorlevel 1 (
        echo [ОШИБКА] Не удалось установить npm-зависимости.
        pause
        exit /b 1
    )
    cd ..
    echo   Готово.
) else (
    echo [2/3] Frontend-зависимости уже установлены.
)

REM ---------- Проверка моделей ----------
if not exist "backend\app\models\autoencoder.npz" (
    echo [ОШИБКА] ML-модели не найдены: backend\app\models\autoencoder.npz
    echo Убедись, что склонировал проект полностью.
    pause
    exit /b 1
)

echo.
echo [3/3] Запускаю серверы...
echo.

REM ---------- Запуск backend в отдельном окне ----------
start "NetShield Backend" cmd /k "cd /d %~dp0backend && call .venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000"

REM ---------- Пауза для инициализации backend ----------
timeout /t 3 /nobreak >nul

REM ---------- Запуск frontend в отдельном окне ----------
start "NetShield Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo ============================================
echo   СИСТЕМА ЗАПУЩЕНА!
echo.
echo   Откройте в браузере:
echo   http://localhost:3000
echo.
echo   Backend API:  http://localhost:8000
echo   Swagger docs: http://localhost:8000/docs
echo.
echo   Для остановки: закрой окна "NetShield Backend"
echo   и "NetShield Frontend".
echo ============================================
echo.
pause
