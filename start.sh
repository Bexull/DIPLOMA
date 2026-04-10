#!/bin/bash

# ============================================
# Network IDS — Запуск системы одной командой
# ============================================

echo "============================================"
echo "  Network IDS — Система обнаружения атак"
echo "============================================"
echo ""

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Проверка зависимостей
if [ ! -d "backend/.venv" ]; then
    echo "[1/3] Установка Python-зависимостей..."
    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt -q
    cd ..
    echo "  Готово."
else
    echo "[1/3] Python-зависимости уже установлены."
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "[2/3] Установка Frontend-зависимостей..."
    cd frontend
    npm install --legacy-peer-deps --silent
    cd ..
    echo "  Готово."
else
    echo "[2/3] Frontend-зависимости уже установлены."
fi

# Проверка моделей (в гите лежат .npz веса)
if [ ! -f "backend/app/models/autoencoder.npz" ]; then
    echo "[!] Модели не найдены. Запускаю обучение..."
    cd backend
    source .venv/bin/activate

    # Генерация датасета если нужно
    if [ ! -f "data/CICIDS2017_synthetic.csv" ]; then
        echo "  Генерация датасета..."
        python3 generate_dataset.py
    fi

    echo "  Обучение моделей (2-3 минуты)..."
    python3 -m app.ml.training --data-dir ./data --models-dir ./app/models
    python3 convert_to_numpy.py
    cd ..
fi

# Остановка предыдущих процессов
kill $(lsof -ti:8000) 2>/dev/null
kill $(lsof -ti:3000) 2>/dev/null
sleep 1

echo ""
echo "[3/3] Запуск серверов..."

# Backend
cd "$DIR/backend"
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level warning &
BACKEND_PID=$!
sleep 3

# Frontend
cd "$DIR/frontend"
npm run dev -- --host 2>/dev/null &
FRONTEND_PID=$!
sleep 2

echo ""
echo "============================================"
echo "  СИСТЕМА ЗАПУЩЕНА!"
echo ""
echo "  Откройте в браузере:"
echo "  → http://localhost:3000"
echo ""
echo "  Перейдите в раздел 'Real-time' и"
echo "  выберите сценарий для демонстрации."
echo ""
echo "  Нажмите Ctrl+C для остановки."
echo "============================================"

# Ожидание Ctrl+C
cleanup() {
    echo ""
    echo "Остановка..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

wait
