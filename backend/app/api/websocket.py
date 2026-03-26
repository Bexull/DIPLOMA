"""
WebSocket для real-time мониторинга сетевого трафика.

Сценарии для демонстрации:
- Нормальный трафик (интернет-серфинг)
- DDoS атака
- Сканирование портов
- Brute Force
- Web-атака
- Смешанная атака
"""

import asyncio
import os
import random
import numpy as np
import pandas as pd
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Optional
from datetime import datetime

router = APIRouter()

_pipeline = None

SCENARIOS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'scenarios')

# Реалистичные IP для демонстрации
DEMO_IPS = {
    'normal': {
        'src': ['192.168.1.105', '192.168.1.105', '192.168.1.105'],
        'dst': ['142.250.185.206', '77.88.55.242', '104.244.42.193',
                '151.101.1.140', '93.184.216.34', '31.13.72.36'],
        'dst_names': {
            '142.250.185.206': 'google.com',
            '77.88.55.242': 'yandex.ru',
            '104.244.42.193': 'twitter.com',
            '151.101.1.140': 'reddit.com',
            '93.184.216.34': 'example.com',
            '31.13.72.36': 'facebook.com',
        },
        'ports': [80, 443],
    },
    'ddos': {
        'src': [f'10.0.{random.randint(1,254)}.{random.randint(1,254)}' for _ in range(50)],
        'dst': ['192.168.1.10'],
        'ports': [80, 443, 8080],
    },
    'portscan': {
        'src': ['185.220.101.42'],
        'dst': ['192.168.1.10'],
        'ports': list(range(20, 1024)),
    },
    'bruteforce': {
        'src': ['91.134.200.15', '185.156.73.22'],
        'dst': ['192.168.1.10'],
        'ports': [22, 3389, 21],
    },
    'web_attack': {
        'src': ['203.0.113.50', '198.51.100.23'],
        'dst': ['192.168.1.10'],
        'ports': [80, 443, 8080],
    },
}

# Описания сценариев
SCENARIO_INFO = {
    'normal': {
        'title': 'Нормальный интернет-трафик',
        'description': 'Обычный веб-серфинг: Google, YouTube, соцсети. Система должна показать, что всё в порядке.',
    },
    'ddos': {
        'title': 'DDoS-атака',
        'description': 'Распределённая атака отказа в обслуживании — тысячи запросов с разных IP на наш сервер.',
    },
    'portscan': {
        'title': 'Сканирование портов',
        'description': 'Злоумышленник сканирует порты сервера, ищет уязвимые сервисы.',
    },
    'bruteforce': {
        'title': 'Brute Force (подбор пароля)',
        'description': 'Множественные попытки подключения к SSH/RDP — подбор пароля.',
    },
    'web_attack': {
        'title': 'Web-атака (SQL Injection / XSS)',
        'description': 'Попытки эксплуатации уязвимостей веб-приложения.',
    },
    'mixed': {
        'title': 'Смешанная атака',
        'description': 'Комбинация разных типов атак — полная проверка системы.',
    },
}


def set_pipeline(pipeline):
    global _pipeline
    _pipeline = pipeline


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_json(self, websocket: WebSocket, data: dict):
        await websocket.send_json(data)


manager = ConnectionManager()


@router.get("/api/scenarios")
async def list_scenarios():
    """Список доступных демо-сценариев."""
    return {"scenarios": SCENARIO_INFO}


@router.websocket("/ws/realtime")
async def realtime_monitoring(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get('action', '')

            if action == 'run_scenario':
                scenario = data.get('scenario', 'normal')
                await _run_scenario(websocket, scenario)
            elif action == 'start_live':
                await _run_live_monitor(websocket)
            elif action == 'stop':
                await manager.send_json(websocket, {
                    'type': 'status', 'message': 'Мониторинг остановлен'
                })
            elif action == 'ping':
                await manager.send_json(websocket, {'type': 'pong'})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


async def _run_live_monitor(websocket: WebSocket):
    """Мониторинг реальных соединений компьютера."""
    if _pipeline is None:
        await manager.send_json(websocket, {
            'type': 'error', 'message': 'ML pipeline не загружен'
        })
        return

    from ..ml.live_monitor import ConnectionTracker, connection_to_features

    tracker = ConnectionTracker()

    await manager.send_json(websocket, {
        'type': 'scenario_start',
        'scenario': 'live',
        'title': 'Мониторинг реального трафика',
        'description': 'Анализ ваших сетевых соединений в реальном времени. Откройте браузер и походите по сайтам.',
        'message': 'Мониторинг запущен — откройте любой сайт в браузере',
    })

    record_index = 0

    while True:
        new_connections = tracker.get_new_connections()

        for conn in new_connections:
            features = connection_to_features(conn)
            result = _pipeline.predict_single(features)

            # Определяем приложение по PID
            proc_name = ''
            if conn.get('pid'):
                try:
                    import psutil
                    proc = psutil.Process(conn['pid'])
                    proc_name = proc.name()
                except Exception:
                    pass

            await manager.send_json(websocket, {
                'type': 'prediction',
                'index': record_index,
                'is_attack': result['is_attack'],
                'attack_type': result['attack_type'],
                'anomaly_score': round(result['anomaly_score'], 6),
                'confidence': result['confidence'],
                'timestamp': conn['timestamp'],
                'src_ip': conn['src_ip'],
                'dst_ip': conn['dst_ip'],
                'src_port': conn['src_port'],
                'dst_port': conn['dst_port'],
                'protocol': 'TCP',
                'dst_label': conn['hostname'],
                'process': proc_name,
            })
            record_index += 1

        # Проверка stop
        try:
            msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.8)
            if msg.get('action') == 'stop':
                await manager.send_json(websocket, {
                    'type': 'scenario_complete',
                    'scenario': 'live',
                    'title': 'Мониторинг реального трафика',
                    'message': f'Мониторинг остановлен: {record_index} соединений проанализировано',
                    'total': record_index,
                    'attacks': 0,
                })
                return
        except asyncio.TimeoutError:
            pass


async def _run_scenario(websocket: WebSocket, scenario: str):
    """Запуск демо-сценария с реальными данными из CSV."""
    if _pipeline is None:
        await manager.send_json(websocket, {
            'type': 'error', 'message': 'ML pipeline не загружен'
        })
        return

    # Маппинг сценария → файл
    file_map = {
        'normal': 'normal_traffic.csv',
        'ddos': 'ddos_attack.csv',
        'portscan': 'portscan_attack.csv',
        'bruteforce': 'bruteforce_attack.csv',
        'web_attack': 'web_attack.csv',
        'mixed': 'mixed_attack.csv',
    }

    filename = file_map.get(scenario)
    if not filename:
        await manager.send_json(websocket, {
            'type': 'error', 'message': f'Неизвестный сценарий: {scenario}'
        })
        return

    filepath = os.path.join(SCENARIOS_DIR, filename)
    if not os.path.exists(filepath):
        await manager.send_json(websocket, {
            'type': 'error', 'message': f'Файл сценария не найден: {filename}'
        })
        return

    info = SCENARIO_INFO.get(scenario, {})
    await manager.send_json(websocket, {
        'type': 'scenario_start',
        'scenario': scenario,
        'title': info.get('title', scenario),
        'description': info.get('description', ''),
        'message': f'Запуск: {info.get("title", scenario)}',
    })

    # Загрузка данных
    df = pd.read_csv(filepath, low_memory=False)
    df.columns = df.columns.str.strip()

    # Признаки для pipeline
    feature_names = [f for f in _pipeline.feature_names if f in df.columns]
    if not feature_names:
        stripped = {c.strip(): c for c in df.columns}
        feature_names = [stripped[f.strip()] for f in _pipeline.feature_names if f.strip() in stripped]

    X = df[feature_names].values.astype(np.float32)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    if _pipeline.scaler is not None:
        X = _pipeline.scaler.transform(X)

    # Предсказание целиком (быстро), потом стримим по одному
    all_results = _pipeline.predict(X)

    # IP-профиль для этого сценария
    ip_profile = DEMO_IPS.get(scenario, DEMO_IPS['normal'])

    record_index = 0
    base_time = datetime.now()

    for i, result in enumerate(all_results):
        # Генерируем реалистичные IP/порты
        src_ip = random.choice(ip_profile['src'])
        dst_ip = random.choice(ip_profile['dst'])
        dst_port = random.choice(ip_profile['ports'])
        src_port = random.randint(1024, 65535)

        # Для нормального трафика — показываем имя сайта
        dst_label = ''
        if scenario == 'normal':
            names = ip_profile.get('dst_names', {})
            dst_label = names.get(dst_ip, '')

        # Имитация временного потока
        from datetime import timedelta
        ts = base_time + timedelta(milliseconds=record_index * random.randint(50, 300))

        await manager.send_json(websocket, {
            'type': 'prediction',
            'index': record_index,
            'is_attack': result['is_attack'],
            'attack_type': result['attack_type'],
            'anomaly_score': round(result['anomaly_score'], 6),
            'confidence': result['confidence'],
            'timestamp': ts.isoformat(),
            'src_ip': src_ip,
            'dst_ip': dst_ip,
            'src_port': src_port,
            'dst_port': dst_port,
            'protocol': 'TCP',
            'dst_label': dst_label,
        })

        record_index += 1

        # Скорость стриминга — достаточно чтобы видеть поток
        speed = 0.08 if scenario == 'normal' else 0.04
        await asyncio.sleep(speed)

        # Проверка stop
        try:
            msg = await asyncio.wait_for(websocket.receive_json(), timeout=0.01)
            if msg.get('action') == 'stop':
                await manager.send_json(websocket, {
                    'type': 'status', 'message': 'Мониторинг остановлен'
                })
                return
        except asyncio.TimeoutError:
            pass

    await manager.send_json(websocket, {
        'type': 'scenario_complete',
        'scenario': scenario,
        'message': f'Сценарий завершён: {record_index} потоков проанализировано',
        'total': record_index,
        'attacks': sum(1 for r in all_results if r['is_attack']),
    })
