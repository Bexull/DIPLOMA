"""
Скрипт обучения всех моделей.

Запуск:
    cd backend
    python -m app.ml.training --data-dir ./data --models-dir ./app/models

Результат:
    - Обученные модели сохраняются в models_dir
    - Метрики выводятся в консоль и сохраняются в JSON
"""

import argparse
import json
import os
import time
import numpy as np

from .preprocessing import prepare_data
from .autoencoder import AnomalyDetector
from .classifiers import (
    create_classifiers, train_classifier,
    evaluate_classifier, save_classifier,
)


def train_all(data_dir: str, models_dir: str):
    """Обучить все модели и сохранить результаты."""
    start_time = time.time()

    print("=" * 60)
    print("ОБУЧЕНИЕ СИСТЕМЫ ОБНАРУЖЕНИЯ СЕТЕВЫХ АТАК")
    print("=" * 60)

    # 1. Подготовка данных
    print("\n[1/4] Подготовка данных...")
    data = prepare_data(data_dir, models_dir)

    print(f"\nКоличество признаков: {data['n_features']}")
    print(f"Количество классов: {data['n_classes']}")
    print(f"Классы: {data['class_names']}")

    # 2. Обучение автоэнкодера
    print("\n" + "=" * 60)
    print("[2/4] Обучение автоэнкодера...")
    print("=" * 60)

    anomaly_detector = AnomalyDetector(data['n_features'])
    ae_history = anomaly_detector.train(
        data['X_train_normal'],
        epochs=50,
        batch_size=256,
    )

    # Подбор порога
    anomaly_detector.find_threshold(data['X_test'], data['y_test_binary'])
    ae_metrics = anomaly_detector.evaluate(data['X_test'], data['y_test_binary'])

    # Сохранение автоэнкодера
    anomaly_detector.save(os.path.join(models_dir, 'autoencoder.pt'))

    # 3. Обучение классификаторов
    print("\n" + "=" * 60)
    print("[3/4] Обучение классификаторов...")
    print("=" * 60)

    classifiers = create_classifiers(data['n_features'], data['n_classes'])
    all_results = {
        'Autoencoder': {
            'metrics': ae_metrics,
            'type': 'anomaly_detection',
        }
    }

    for name, clf in classifiers.items():
        train_classifier(name, clf, data['X_train'], data['y_train_multi'])

        result = evaluate_classifier(
            name, clf,
            data['X_test'], data['y_test_multi'],
            data['class_names'],
        )

        save_classifier(name, clf, models_dir)
        all_results[name] = {
            'metrics': result['metrics'],
            'confusion_matrix': result['confusion_matrix'],
            'type': 'classifier',
        }

    # 4. Сводка результатов
    print("\n" + "=" * 60)
    print("[4/4] СВОДКА РЕЗУЛЬТАТОВ")
    print("=" * 60)

    print(f"\n{'Модель':<20} {'Accuracy':>10} {'F1 (w)':>10} {'F1 (m)':>10} {'ROC AUC':>10}")
    print("-" * 62)

    for name, result in all_results.items():
        m = result['metrics']
        if result['type'] == 'anomaly_detection':
            print(
                f"{'Autoencoder':<20} "
                f"{m.get('accuracy', 0):>10.4f} "
                f"{m.get('f1', 0):>10.4f} "
                f"{'—':>10} "
                f"{m.get('roc_auc', 0):>10.4f}"
            )
        else:
            print(
                f"{name:<20} "
                f"{m.get('accuracy', 0):>10.4f} "
                f"{m.get('f1_weighted', 0):>10.4f} "
                f"{m.get('f1_macro', 0):>10.4f} "
                f"{m.get('roc_auc', 'N/A'):>10}"
            )

    # Сохранение метрик в JSON
    # Конвертируем numpy значения в обычные Python типы
    def convert_numpy(obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return obj

    metrics_path = os.path.join(models_dir, 'metrics.json')
    serializable_results = {}
    for name, result in all_results.items():
        serializable_results[name] = {
            'metrics': {k: convert_numpy(v) for k, v in result['metrics'].items()},
            'type': result['type'],
        }
        if 'confusion_matrix' in result:
            serializable_results[name]['confusion_matrix'] = result['confusion_matrix']

    with open(metrics_path, 'w', encoding='utf-8') as f:
        json.dump(serializable_results, f, indent=2, ensure_ascii=False)

    elapsed = time.time() - start_time
    print(f"\nВремя обучения: {elapsed/60:.1f} минут")
    print(f"Метрики сохранены: {metrics_path}")
    print(f"Модели сохранены: {models_dir}")


def main():
    parser = argparse.ArgumentParser(description='Обучение моделей IDS')
    parser.add_argument(
        '--data-dir', type=str, default='./data',
        help='Директория с CSV файлами CICIDS2017',
    )
    parser.add_argument(
        '--models-dir', type=str, default='./app/models',
        help='Директория для сохранения моделей',
    )
    args = parser.parse_args()

    train_all(args.data_dir, args.models_dir)


if __name__ == '__main__':
    main()
