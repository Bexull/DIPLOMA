"""
Генерация синтетического датасета, имитирующего CICIDS2017.

Структура и имена колонок полностью совпадают с оригиналом.
Это позволяет обучить и продемонстрировать систему.
Для реального использования замените на оригинальный CICIDS2017.
"""

import numpy as np
import pandas as pd
import os

np.random.seed(42)

FEATURES = [
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

# Профили трафика — каждый тип имеет свои характерные паттерны
PROFILES = {
    'BENIGN': {
        'mean_shift': 0, 'std_scale': 1.0,
        'flow_duration': (1000, 500000),
        'packets': (1, 50),
        'bytes_per_s': (100, 100000),
    },
    'DDoS': {
        'mean_shift': 3, 'std_scale': 0.3,
        'flow_duration': (10, 1000),
        'packets': (100, 10000),
        'bytes_per_s': (500000, 10000000),
    },
    'PortScan': {
        'mean_shift': 2, 'std_scale': 0.5,
        'flow_duration': (1, 100),
        'packets': (1, 5),
        'bytes_per_s': (10, 1000),
    },
    'Brute Force': {
        'mean_shift': 1.5, 'std_scale': 0.8,
        'flow_duration': (5000, 60000),
        'packets': (10, 100),
        'bytes_per_s': (1000, 50000),
    },
    'Web Attack': {
        'mean_shift': 1.8, 'std_scale': 0.6,
        'flow_duration': (1000, 30000),
        'packets': (5, 50),
        'bytes_per_s': (5000, 200000),
    },
    'Bot': {
        'mean_shift': 2.5, 'std_scale': 0.4,
        'flow_duration': (100, 10000),
        'packets': (10, 500),
        'bytes_per_s': (10000, 500000),
    },
    'Infiltration': {
        'mean_shift': 1.2, 'std_scale': 0.9,
        'flow_duration': (10000, 1000000),
        'packets': (5, 200),
        'bytes_per_s': (1000, 100000),
    },
    'DoS': {
        'mean_shift': 2.8, 'std_scale': 0.35,
        'flow_duration': (100, 5000),
        'packets': (50, 5000),
        'bytes_per_s': (100000, 5000000),
    },
}

# Распределение классов (приближено к CICIDS2017)
CLASS_DISTRIBUTION = {
    'BENIGN': 0.60,
    'DDoS': 0.10,
    'PortScan': 0.08,
    'DoS': 0.08,
    'Brute Force': 0.05,
    'Web Attack': 0.04,
    'Bot': 0.03,
    'Infiltration': 0.02,
}

TOTAL_RECORDS = 200000  # Достаточно для обучения, не слишком долго


def generate_flow_features(n: int, profile: dict) -> np.ndarray:
    """Сгенерировать признаки потока для данного профиля."""
    n_features = len(FEATURES)
    data = np.random.randn(n, n_features) * profile['std_scale']
    data += profile['mean_shift']

    # Реалистичные значения для ключевых признаков
    dur_min, dur_max = profile['flow_duration']
    data[:, 0] = np.random.uniform(dur_min, dur_max, n)  # Flow Duration

    pkt_min, pkt_max = profile['packets']
    data[:, 1] = np.random.randint(pkt_min, pkt_max + 1, n)  # Total Fwd Packets
    data[:, 2] = np.random.randint(max(0, pkt_min - 1), pkt_max, n)  # Total Bwd Packets

    bps_min, bps_max = profile['bytes_per_s']
    data[:, 13] = np.random.uniform(bps_min, bps_max, n)  # Flow Bytes/s
    data[:, 14] = data[:, 1] / (data[:, 0] / 1e6 + 1e-8)  # Flow Packets/s

    # Флаги (бинарные/целые)
    for flag_idx in [29, 39, 40, 41, 42, 43, 44]:
        if flag_idx < n_features:
            data[:, flag_idx] = np.random.randint(0, 2, n)

    # Убираем отрицательные значения для размеров/длин
    for idx in [0, 1, 2, 3, 4, 5, 7, 9, 11, 13, 14, 34, 35, 36, 45, 46, 47, 48]:
        if idx < n_features:
            data[:, idx] = np.abs(data[:, idx])

    return data


def main():
    print(f"Генерация синтетического датасета ({TOTAL_RECORDS} записей)...")

    all_data = []
    all_labels = []

    for label, fraction in CLASS_DISTRIBUTION.items():
        n = int(TOTAL_RECORDS * fraction)
        profile = PROFILES[label]
        features = generate_flow_features(n, profile)
        all_data.append(features)
        all_labels.extend([label] * n)
        print(f"  {label}: {n} записей")

    X = np.vstack(all_data)
    y = np.array(all_labels)

    # Перемешиваем
    indices = np.random.permutation(len(X))
    X = X[indices]
    y = y[indices]

    # Создаём DataFrame
    df = pd.DataFrame(X, columns=FEATURES)
    df[' Label'] = y

    # Сохраняем
    output_dir = os.path.join(os.path.dirname(__file__), 'data')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'CICIDS2017_synthetic.csv')
    df.to_csv(output_path, index=False)

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"\nСохранено: {output_path}")
    print(f"Размер: {size_mb:.1f} MB")
    print(f"Записей: {len(df)}")
    print(f"\nРаспределение классов:")
    print(df[' Label'].value_counts())


if __name__ == '__main__':
    main()
