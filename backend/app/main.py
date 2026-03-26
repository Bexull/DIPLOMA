"""
FastAPI приложение — система обнаружения сетевых атак (IDS).

Запуск:
    cd backend
    uvicorn app.main:app --reload --port 8000
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router, set_pipeline as set_api_pipeline
from .api.websocket import router as ws_router, set_pipeline as set_ws_pipeline
from .db.database import init_db

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Инициализация при запуске приложения."""
    # Создание таблиц БД
    await init_db()

    # Загрузка ML pipeline (если модели обучены)
    pipeline = None
    autoencoder_path = os.path.join(MODELS_DIR, 'autoencoder.pt')

    if os.path.exists(autoencoder_path):
        try:
            from .ml.pipeline import IDSPipeline
            pipeline = IDSPipeline.load(MODELS_DIR, classifier_name='XGBoost')
            print("ML pipeline загружен успешно")
        except Exception as e:
            print(f"Ошибка загрузки ML pipeline: {e}")
            print("API будет работать без ML-анализа. Обучите модели:")
            print("  python -m app.ml.training --data-dir ./data")
    else:
        print("Модели не найдены. Обучите их командой:")
        print("  python -m app.ml.training --data-dir ./data")

    # Передаём pipeline в роутеры
    set_api_pipeline(pipeline)
    set_ws_pipeline(pipeline)

    # Загрузка метрик в БД (если есть файл)
    metrics_path = os.path.join(MODELS_DIR, 'metrics.json')
    if os.path.exists(metrics_path):
        import json
        from .db.database import save_model_metrics
        with open(metrics_path, 'r') as f:
            metrics = json.load(f)
        for name, data in metrics.items():
            await save_model_metrics(name, data.get('type', 'classifier'), data['metrics'])

    yield


app = FastAPI(
    title="Network IDS — Система обнаружения сетевых атак",
    description=(
        "API для обнаружения сетевых атак с использованием "
        "методов машинного обучения. Двухуровневая архитектура: "
        "автоэнкодер для обнаружения аномалий + классификатор для "
        "определения типа атаки."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS для React-фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(api_router)
app.include_router(ws_router)


@app.get("/")
async def root():
    return {
        "name": "Network IDS",
        "description": "Система обнаружения сетевых атак с ML",
        "docs": "/docs",
        "api": "/api",
    }
