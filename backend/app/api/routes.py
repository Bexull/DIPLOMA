"""
REST API эндпоинты для системы обнаружения сетевых атак.
"""

import io
import json
import os
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from ..db.database import (
    save_analysis, save_predictions, get_analyses,
    get_analysis_predictions, get_stats, get_model_metrics,
)
from .url_analyzer import analyze_url, URLAnalysisRequest, URLAnalysisResponse

router = APIRouter(prefix="/api", tags=["IDS API"])

# Глобальная ссылка на pipeline (инициализируется в main.py)
_pipeline = None
MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')


def set_pipeline(pipeline):
    """Установить ML pipeline (вызывается из main.py)."""
    global _pipeline
    _pipeline = pipeline


def get_pipeline():
    """Получить ML pipeline."""
    if _pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="ML pipeline не загружен. Обучите модели командой: "
                   "python -m app.ml.training"
        )
    return _pipeline


# --- Pydantic модели ---

class PredictionResult(BaseModel):
    is_attack: bool
    attack_type: str
    anomaly_score: float
    confidence: float


class AnalysisResponse(BaseModel):
    analysis_id: int
    filename: str
    total_records: int
    attacks_found: int
    attack_percentage: float
    predictions: list[PredictionResult]


class StatsResponse(BaseModel):
    total_analyses: int
    total_records_analyzed: int
    total_attacks_found: int
    attack_percentage: float
    attack_distribution: dict


# --- Эндпоинты ---

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_traffic(
    file: UploadFile = File(...),
    max_records: int = Query(default=10000, le=100000),
):
    """
    Анализ сетевого трафика из CSV файла.

    Загрузите CSV-файл с сетевым трафиком (формат CICIDS2017).
    Система проанализирует каждую запись и определит атаки.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Поддерживаются только CSV файлы")

    pipeline = get_pipeline()

    # Чтение CSV
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content), low_memory=False)
        df.columns = df.columns.str.strip()
    except Exception as e:
        raise HTTPException(400, f"Ошибка чтения CSV: {str(e)}")

    if len(df) == 0:
        raise HTTPException(400, "CSV файл пустой")

    # Ограничиваем количество записей
    if len(df) > max_records:
        df = df.head(max_records)

    # Предсказание
    try:
        predictions = pipeline.predict_batch(df)
    except Exception as e:
        raise HTTPException(500, f"Ошибка анализа: {str(e)}")

    attacks_found = sum(1 for p in predictions if p['is_attack'])
    attack_pct = round(attacks_found / len(predictions) * 100, 2)

    # Сохранение в БД
    analysis_id = await save_analysis(
        filename=file.filename,
        total_records=len(predictions),
        attacks_found=attacks_found,
    )
    await save_predictions(analysis_id, predictions)

    return AnalysisResponse(
        analysis_id=analysis_id,
        filename=file.filename,
        total_records=len(predictions),
        attacks_found=attacks_found,
        attack_percentage=attack_pct,
        predictions=[PredictionResult(**p) for p in predictions],
    )


@router.get("/models")
async def get_models_info():
    """
    Информация об обученных моделях и их метриках.

    Возвращает метрики из БД или из файла metrics.json.
    """
    # Сначала пробуем из БД
    db_metrics = await get_model_metrics()
    if db_metrics:
        return {"models": db_metrics, "source": "database"}

    # Иначе из файла
    metrics_path = os.path.join(MODELS_DIR, 'metrics.json')
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r', encoding='utf-8') as f:
            metrics = json.load(f)
        return {"models": metrics, "source": "file"}

    raise HTTPException(404, "Метрики моделей не найдены. Обучите модели.")


@router.get("/history")
async def get_history(limit: int = Query(default=50, le=200)):
    """История проведённых анализов."""
    analyses = await get_analyses(limit=limit)
    return {"analyses": analyses, "total": len(analyses)}


@router.get("/history/{analysis_id}")
async def get_analysis_detail(analysis_id: int):
    """Детали конкретного анализа с предсказаниями."""
    predictions = await get_analysis_predictions(analysis_id)
    if not predictions:
        raise HTTPException(404, f"Анализ #{analysis_id} не найден")

    return {
        "analysis_id": analysis_id,
        "predictions": predictions,
        "total": len(predictions),
        "attacks": sum(1 for p in predictions if p['is_attack']),
    }


@router.get("/stats", response_model=StatsResponse)
async def get_statistics():
    """Агрегированная статистика по всем анализам."""
    stats = await get_stats()
    return StatsResponse(**stats)


@router.post("/analyze-url", response_model=URLAnalysisResponse)
async def analyze_url_endpoint(request: URLAnalysisRequest):
    """
    Анализ безопасности URL-адреса.

    Проверяет SSL-сертификат, заголовки безопасности и
    прогоняет характеристики соединения через ML-pipeline.
    """
    pipeline = get_pipeline()
    try:
        result = await analyze_url(request.url, pipeline)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/health")
async def health_check():
    """Проверка работоспособности сервиса."""
    pipeline_loaded = _pipeline is not None
    return {
        "status": "ok" if pipeline_loaded else "degraded",
        "pipeline_loaded": pipeline_loaded,
        "models_dir": MODELS_DIR,
    }
