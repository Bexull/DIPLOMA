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

## Что делать, если ML не загрузился

Если в логе backend'а видно `Модели не найдены`, проверь что есть файл `backend/app/models/autoencoder.npz`. Он должен прийти из гита. Если его нет — обнови репозиторий:

```bash
git pull
```

---

## Документация для защиты

См. [docs/](docs/) — там есть обзор проекта, описание кнопок, сценарии защиты.
