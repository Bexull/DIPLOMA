"""
SQLite база данных для хранения истории анализов.
"""

import aiosqlite
import os
from datetime import datetime
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'ids.db')


async def get_db():
    """Получить соединение с БД."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    """Создать таблицы при первом запуске."""
    db = await aiosqlite.connect(DB_PATH)
    await db.executescript("""
        CREATE TABLE IF NOT EXISTS analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            total_records INTEGER NOT NULL,
            attacks_found INTEGER NOT NULL,
            attack_percentage REAL NOT NULL,
            model_used TEXT NOT NULL DEFAULT 'xgboost'
        );

        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_id INTEGER NOT NULL,
            record_index INTEGER NOT NULL,
            is_attack INTEGER NOT NULL,
            attack_type TEXT NOT NULL,
            anomaly_score REAL NOT NULL,
            confidence REAL NOT NULL,
            FOREIGN KEY (analysis_id) REFERENCES analyses(id)
        );

        CREATE TABLE IF NOT EXISTS model_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_name TEXT NOT NULL UNIQUE,
            model_type TEXT NOT NULL,
            accuracy REAL,
            precision_score REAL,
            recall REAL,
            f1_weighted REAL,
            f1_macro REAL,
            roc_auc REAL,
            confusion_matrix TEXT,
            updated_at TEXT NOT NULL
        );
    """)
    await db.commit()
    await db.close()


async def save_analysis(
    filename: str,
    total_records: int,
    attacks_found: int,
    model_used: str = 'xgboost',
) -> int:
    """Сохранить запись об анализе. Возвращает ID."""
    db = await get_db()
    attack_pct = (attacks_found / total_records * 100) if total_records > 0 else 0
    cursor = await db.execute(
        """INSERT INTO analyses (filename, timestamp, total_records,
           attacks_found, attack_percentage, model_used)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (filename, datetime.now().isoformat(), total_records,
         attacks_found, round(attack_pct, 2), model_used),
    )
    analysis_id = cursor.lastrowid
    await db.commit()
    await db.close()
    return analysis_id


async def save_predictions(analysis_id: int, predictions: list):
    """Сохранить предсказания для анализа."""
    db = await get_db()
    rows = [
        (analysis_id, i, int(p['is_attack']), p['attack_type'],
         p['anomaly_score'], p['confidence'])
        for i, p in enumerate(predictions)
    ]
    await db.executemany(
        """INSERT INTO predictions
           (analysis_id, record_index, is_attack, attack_type, anomaly_score, confidence)
           VALUES (?, ?, ?, ?, ?, ?)""",
        rows,
    )
    await db.commit()
    await db.close()


async def get_analyses(limit: int = 50) -> list:
    """Получить последние анализы."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM analyses ORDER BY id DESC LIMIT ?", (limit,)
    )
    rows = await cursor.fetchall()
    await db.close()
    return [dict(r) for r in rows]


async def get_analysis_predictions(analysis_id: int) -> list:
    """Получить предсказания для конкретного анализа."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM predictions WHERE analysis_id = ? ORDER BY record_index",
        (analysis_id,),
    )
    rows = await cursor.fetchall()
    await db.close()
    return [dict(r) for r in rows]


async def get_stats() -> dict:
    """Получить агрегированную статистику."""
    db = await get_db()

    cursor = await db.execute("SELECT COUNT(*) as cnt FROM analyses")
    total_analyses = (await cursor.fetchone())['cnt']

    cursor = await db.execute(
        "SELECT COALESCE(SUM(total_records), 0) as total, "
        "COALESCE(SUM(attacks_found), 0) as attacks FROM analyses"
    )
    row = await cursor.fetchone()
    total_records = row['total']
    total_attacks = row['attacks']

    # Распределение типов атак
    cursor = await db.execute(
        "SELECT attack_type, COUNT(*) as cnt FROM predictions "
        "WHERE is_attack = 1 GROUP BY attack_type ORDER BY cnt DESC"
    )
    attack_distribution = {r['attack_type']: r['cnt'] for r in await cursor.fetchall()}

    await db.close()

    return {
        'total_analyses': total_analyses,
        'total_records_analyzed': total_records,
        'total_attacks_found': total_attacks,
        'attack_percentage': round(
            total_attacks / total_records * 100, 2
        ) if total_records > 0 else 0,
        'attack_distribution': attack_distribution,
    }


async def save_model_metrics(model_name: str, model_type: str, metrics: dict):
    """Сохранить/обновить метрики модели."""
    import json
    db = await get_db()
    cm = json.dumps(metrics.get('confusion_matrix', []))
    await db.execute(
        """INSERT OR REPLACE INTO model_metrics
           (model_name, model_type, accuracy, precision_score, recall,
            f1_weighted, f1_macro, roc_auc, confusion_matrix, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (model_name, model_type,
         metrics.get('accuracy'), metrics.get('precision'),
         metrics.get('recall'), metrics.get('f1_weighted', metrics.get('f1')),
         metrics.get('f1_macro'), metrics.get('roc_auc'),
         cm, datetime.now().isoformat()),
    )
    await db.commit()
    await db.close()


async def get_model_metrics() -> list:
    """Получить метрики всех моделей."""
    import json
    db = await get_db()
    cursor = await db.execute("SELECT * FROM model_metrics ORDER BY model_name")
    rows = await cursor.fetchall()
    await db.close()

    result = []
    for r in rows:
        d = dict(r)
        d['confusion_matrix'] = json.loads(d['confusion_matrix'])
        result.append(d)
    return result
