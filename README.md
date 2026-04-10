# NetShield IDS

Учебная система обнаружения сетевых атак на базе машинного обучения. Двухуровневая архитектура: автоэнкодер ищет аномалии, классификатор (XGBoost) определяет тип атаки.

**Стек:** FastAPI + React + NumPy-инференс (PyTorch не нужен).

---

## Быстрый запуск (Windows)

### Требования
- [Python 3.11+](https://www.python.org/downloads/) — при установке поставь галочку **"Add Python to PATH"**
- [Node.js 20+](https://nodejs.org/)
- Git

### Шаги
```cmd
git clone https://github.com/Bexull/DIPLOMA.git
cd DIPLOMA
start.bat
```

Скрипт сам:
1. Создаст Python venv и поставит зависимости из `requirements-prod.txt`
2. Поставит npm-пакеты для фронтенда
3. Запустит backend на `:8000` и frontend на `:3000` в отдельных окнах

Открой в браузере: **http://localhost:3000**

Для остановки — закрой окна `NetShield Backend` и `NetShield Frontend`.

---

## Быстрый запуск (Mac / Linux)

```bash
git clone https://github.com/Bexull/DIPLOMA.git
cd DIPLOMA
./start.sh
```

---

## Запуск через Docker (любая ОС)

Требуется [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/Bexull/DIPLOMA.git
cd DIPLOMA
docker-compose up --build
```

Открой **http://localhost:3000**.

---

## Ручной запуск (если `start.bat` не сработал)

**Backend:**
```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-prod.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Frontend** (в отдельном окне):
```cmd
cd frontend
npm install --legacy-peer-deps
npm run dev
```

---

## Структура проекта

```
.
├── backend/              # FastAPI + ML
│   ├── app/
│   │   ├── api/          # REST + WebSocket endpoints
│   │   ├── ml/           # Pipeline, NumPy-инференс
│   │   └── models/       # Обученные веса (.npz, .pkl)
│   ├── data/scenarios/   # Демо-датасеты для Real-time
│   └── requirements-prod.txt
├── frontend/             # React + Vite + Ant Design
├── docs/                 # Документация для защиты диплома
├── docker-compose.yml
├── start.sh              # Запуск на Mac/Linux
└── start.bat             # Запуск на Windows
```

---

## Тестирование системы

### Вариант 1. Встроенные сценарии (Real-time)
Открой **http://localhost:3000** → раздел **Real-time** → выбери один из сценариев:
- `normal_traffic` — нормальный трафик
- `ddos_attack` — DDoS атака
- `portscan_attack` — сканирование портов
- `bruteforce_attack` — брутфорс
- `web_attack` — веб-атаки
- `mixed_attack` — смешанный поток

Система начнёт по одной записи «проигрывать» трафик через ML и показывать обнаруженные атаки в реальном времени.

### Вариант 2. Загрузка своего CSV (Analyze)
Открой **http://localhost:3000** → раздел **Analyze** → загрузи CSV-файл.

**Важно — формат CSV.** Модель обучена на датасете **CICIDS2017** и ожидает ~66 колонок сетевых flow-признаков:
```
Flow Duration, Total Fwd Packets, Total Backward Packets,
Fwd Packet Length Max/Min/Mean/Std, Flow IAT Mean/Std, ...
```

Если в твоём CSV другие колонки — анализ упадёт с ошибкой валидации. Готовые примеры правильного формата лежат в [backend/data/scenarios/](backend/data/scenarios/) — можно скачать любой и загрузить как свой, чтобы проверить флоу.

> **Не подойдут:** датасеты других доменов (host-based malware, системные метрики, логи приложений). Это не потому что «система плохая» — просто модель обучена именно на сетевом трафике CICIDS2017.

---

## Что делать, если ML не загрузился

Если в логе backend'а видно `Модели не найдены`, проверь что есть файл `backend/app/models/autoencoder.npz`. Он должен прийти из гита. Если его нет — обнови репозиторий:

```bash
git pull
```

---

## Документация для защиты

См. [docs/](docs/) — там есть обзор проекта, описание кнопок, сценарии защиты.
