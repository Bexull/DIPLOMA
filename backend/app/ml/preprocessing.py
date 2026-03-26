"""
Модуль предобработки данных CICIDS2017.

Загрузка, очистка, нормализация и разделение датасета
для обучения моделей обнаружения сетевых атак.
"""

import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
import joblib
from typing import Tuple, Optional


# Признаки, которые будем использовать (наиболее информативные)
SELECTED_FEATURES = [
    'Flow Duration', 'Total Fwd Packets', 'Total Backward Packets',
    'Total Length of Fwd Packets', 'Total Length of Bwd Packets',
    'Fwd Packet Length Max', 'Fwd Packet Length Min', 'Fwd Packet Length Mean',
    'Fwd Packet Length Std', 'Bwd Packet Length Max', 'Bwd Packet Length Min',
    'Bwd Packet Length Mean', 'Bwd Packet Length Std', 'Flow Bytes/s',
    'Flow Packets/s', 'Flow IAT Mean', 'Flow IAT Std', 'Flow IAT Max',
    'Flow IAT Min', 'Fwd IAT Total', 'Fwd IAT Mean', 'Fwd IAT Std',
    'Fwd IAT Max', 'Fwd IAT Min', 'Bwd IAT Total', 'Bwd IAT Mean',
    'Bwd IAT Std', 'Bwd IAT Max', 'Bwd IAT Min', 'Fwd PSH Flags',
    'Fwd Header Length', 'Bwd Header Length', 'Fwd Packets/s',
    'Bwd Packets/s', 'Min Packet Length', 'Max Packet Length',
    'Packet Length Mean', 'Packet Length Std', 'Packet Length Variance',
    'FIN Flag Count', 'SYN Flag Count', 'RST Flag Count', 'PSH Flag Count',
    'ACK Flag Count', 'URG Flag Count', 'Down/Up Ratio',
    'Average Packet Size', 'Avg Fwd Segment Size', 'Avg Bwd Segment Size',
    'Subflow Fwd Packets', 'Subflow Fwd Bytes', 'Subflow Bwd Packets',
    'Subflow Bwd Bytes', 'Init_Win_bytes_forward', 'Init_Win_bytes_backward',
    'act_data_pkt_fwd', 'min_seg_size_forward', 'Active Mean', 'Active Std',
    'Active Max', 'Active Min', 'Idle Mean', 'Idle Std', 'Idle Max', 'Idle Min',
]

LABEL_COLUMN = ' Label'

# Маппинг атак в категории для упрощения
ATTACK_CATEGORY_MAP = {
    'BENIGN': 'BENIGN',
    'FTP-Patator': 'Brute Force',
    'SSH-Patator': 'Brute Force',
    'DoS slowloris': 'DoS',
    'DoS Slowhttptest': 'DoS',
    'DoS Hulk': 'DoS',
    'DoS GoldenEye': 'DoS',
    'Heartbleed': 'DoS',
    'Web Attack \x96 Brute Force': 'Web Attack',
    'Web Attack \x96 XSS': 'Web Attack',
    'Web Attack \x96 Sql Injection': 'Web Attack',
    'Web Attack – Brute Force': 'Web Attack',
    'Web Attack – XSS': 'Web Attack',
    'Web Attack – Sql Injection': 'Web Attack',
    'Infiltration': 'Infiltration',
    'Bot': 'Bot',
    'PortScan': 'PortScan',
    'DDoS': 'DDoS',
}


def load_dataset(data_dir: str) -> pd.DataFrame:
    """Загрузить все CSV файлы CICIDS2017 из директории."""
    csv_files = sorted([
        os.path.join(data_dir, f)
        for f in os.listdir(data_dir)
        if f.endswith('.csv')
    ])

    if not csv_files:
        raise FileNotFoundError(
            f"CSV файлы не найдены в {data_dir}. "
            "Скачайте CICIDS2017 с https://www.unb.ca/cic/datasets/ids-2017.html"
        )

    dfs = []
    for f in csv_files:
        print(f"Загрузка: {os.path.basename(f)}")
        df = pd.read_csv(f, encoding='utf-8', low_memory=False)
        # Убираем пробелы в названиях колонок
        df.columns = df.columns.str.strip()
        dfs.append(df)

    data = pd.concat(dfs, ignore_index=True)
    print(f"Загружено {len(data)} записей из {len(csv_files)} файлов")
    return data


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """Очистка данных: удаление NaN, Inf, дубликатов."""
    initial_len = len(df)

    # Стандартизируем имя колонки с меткой
    if 'Label' in df.columns and ' Label' not in df.columns:
        df = df.rename(columns={'Label': ' Label'})

    # Заменяем Inf на NaN, затем удаляем NaN
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.dropna()

    # Удаляем дубликаты
    df = df.drop_duplicates()

    removed = initial_len - len(df)
    print(f"Очистка: удалено {removed} записей ({removed/initial_len*100:.1f}%)")
    print(f"Осталось: {len(df)} записей")

    return df.reset_index(drop=True)


def map_labels(df: pd.DataFrame, use_categories: bool = True) -> pd.DataFrame:
    """Маппинг меток атак в категории."""
    label_col = 'Label' if 'Label' in df.columns else ' Label'

    if use_categories:
        df['attack_category'] = df[label_col].map(ATTACK_CATEGORY_MAP)
        # Неизвестные метки → оставляем как есть
        unmapped = df['attack_category'].isna()
        if unmapped.any():
            df.loc[unmapped, 'attack_category'] = df.loc[unmapped, label_col]
        df['is_attack'] = (df['attack_category'] != 'BENIGN').astype(int)
    else:
        df['attack_category'] = df[label_col]
        df['is_attack'] = (df[label_col] != 'BENIGN').astype(int)

    print(f"\nРаспределение классов:")
    print(df['attack_category'].value_counts())
    print(f"\nНормальный трафик: {(~df['is_attack'].astype(bool)).sum()}")
    print(f"Атаки: {df['is_attack'].sum()}")

    return df


def select_features(df: pd.DataFrame) -> list:
    """Выбрать доступные признаки из списка SELECTED_FEATURES."""
    available = [f for f in SELECTED_FEATURES if f in df.columns]

    # Если стандартные имена не найдены, попробовать без пробелов
    if len(available) < 10:
        stripped_cols = {c.strip(): c for c in df.columns}
        available = []
        for f in SELECTED_FEATURES:
            f_stripped = f.strip()
            if f_stripped in stripped_cols:
                available.append(stripped_cols[f_stripped])
            elif f in df.columns:
                available.append(f)

    print(f"Выбрано {len(available)} признаков из {len(SELECTED_FEATURES)}")
    return available


def prepare_data(
    data_dir: str,
    models_dir: str,
    test_size: float = 0.2,
    use_categories: bool = True,
) -> dict:
    """
    Полный pipeline подготовки данных.

    Returns:
        dict с ключами:
        - X_train, X_test: нормализованные признаки
        - y_train_binary, y_test_binary: бинарные метки (0=норма, 1=атака)
        - y_train_multi, y_test_multi: мультиклассовые метки (закодированные)
        - X_train_normal: нормальный трафик для автоэнкодера
        - feature_names: список признаков
        - label_encoder: LabelEncoder для мультиклассов
        - scaler: StandardScaler
    """
    # 1. Загрузка
    df = load_dataset(data_dir)

    # 2. Очистка
    df = clean_data(df)

    # 3. Маппинг меток
    df = map_labels(df, use_categories=use_categories)

    # 4. Выбор признаков
    feature_names = select_features(df)
    X = df[feature_names].values.astype(np.float32)
    y_binary = df['is_attack'].values.astype(np.int64)

    # 5. Кодирование мультиклассовых меток
    label_encoder = LabelEncoder()
    y_multi = label_encoder.fit_transform(df['attack_category'].values)

    # 6. Разделение на train/test (стратифицированное)
    X_train, X_test, y_train_b, y_test_b, y_train_m, y_test_m = train_test_split(
        X, y_binary, y_multi,
        test_size=test_size,
        random_state=42,
        stratify=y_multi,
    )

    print(f"\nTrain: {len(X_train)}, Test: {len(X_test)}")

    # 7. Нормализация
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    # 8. Отдельный набор нормального трафика для автоэнкодера
    normal_mask = y_train_b == 0
    X_train_normal = X_train[normal_mask]
    print(f"Нормальный трафик для автоэнкодера: {len(X_train_normal)} записей")

    # 9. Сохранение scaler и label_encoder
    os.makedirs(models_dir, exist_ok=True)
    joblib.dump(scaler, os.path.join(models_dir, 'scaler.pkl'))
    joblib.dump(label_encoder, os.path.join(models_dir, 'label_encoder.pkl'))
    joblib.dump(feature_names, os.path.join(models_dir, 'feature_names.pkl'))

    return {
        'X_train': X_train.astype(np.float32),
        'X_test': X_test.astype(np.float32),
        'y_train_binary': y_train_b,
        'y_test_binary': y_test_b,
        'y_train_multi': y_train_m,
        'y_test_multi': y_test_m,
        'X_train_normal': X_train_normal.astype(np.float32),
        'feature_names': feature_names,
        'label_encoder': label_encoder,
        'scaler': scaler,
        'n_features': X_train.shape[1],
        'n_classes': len(label_encoder.classes_),
        'class_names': list(label_encoder.classes_),
    }
