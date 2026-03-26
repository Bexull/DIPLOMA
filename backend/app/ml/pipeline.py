"""
Двухуровневый ML-pipeline для обнаружения сетевых атак.

Уровень 1: Автоэнкодер определяет — нормальный трафик или аномалия.
Уровень 2: Если аномалия — классификатор определяет тип атаки.
"""

import numpy as np
import joblib
import os
from typing import Optional

from .numpy_inference import NumpyAutoencoder, NumpyMLP


class IDSPipeline:
    """
    Intrusion Detection System — двухуровневый pipeline.

    Уровень 1: Autoencoder → Нормально / Аномалия
    Уровень 2: Classifier → Тип атаки (если аномалия)
    """

    def __init__(
        self,
        anomaly_detector=None,
        classifier=None,
        classifier_name: str = 'XGBoost',
        label_encoder=None,
        scaler=None,
        feature_names: list = None,
    ):
        self.anomaly_detector = anomaly_detector
        self.classifier = classifier
        self.classifier_name = classifier_name
        self.label_encoder = label_encoder
        self.scaler = scaler
        self.feature_names = feature_names

    def predict(self, X: np.ndarray) -> list:
        """
        Двухуровневое предсказание.

        Args:
            X: нормализованные признаки (n_samples, n_features)

        Returns:
            list of dict: для каждого сэмпла:
                - is_attack: bool
                - attack_type: str (или 'BENIGN')
                - anomaly_score: float (ошибка реконструкции)
                - confidence: float
        """
        results = []

        # Уровень 1: Обнаружение аномалий
        anomaly_scores = self.anomaly_detector.predict_scores(X)
        anomaly_predictions = self.anomaly_detector.predict(X)

        # Уровень 2: Классификация типа атаки (для всех записей)
        class_predictions = self.classifier.predict(X)
        class_probas = self.classifier.predict_proba(X)

        for i in range(len(X)):
            is_anomaly = bool(anomaly_predictions[i])

            if is_anomaly:
                pred_class = int(class_predictions[i])
                attack_type = self.label_encoder.inverse_transform([pred_class])[0]
                confidence = float(np.max(class_probas[i]))

                if attack_type == 'BENIGN':
                    attack_type = 'Unknown Attack'
                    confidence = float(anomaly_scores[i])
            else:
                attack_type = 'BENIGN'
                confidence = 1.0 - float(
                    anomaly_scores[i] / (self.anomaly_detector.threshold + 1e-8)
                )
                confidence = max(0.0, min(1.0, confidence))

            results.append({
                'is_attack': is_anomaly,
                'attack_type': attack_type,
                'anomaly_score': float(anomaly_scores[i]),
                'confidence': round(confidence, 4),
            })

        return results

    def predict_single(self, features: dict) -> dict:
        """Предсказание для одной записи."""
        if self.feature_names is None:
            raise ValueError("feature_names не установлены")

        x = np.array([[features.get(f, 0) for f in self.feature_names]], dtype=np.float32)

        if self.scaler is not None:
            x = self.scaler.transform(x)

        results = self.predict(x)
        return results[0]

    def predict_batch(self, df) -> list:
        """Предсказание для DataFrame (из загруженного CSV)."""
        if self.feature_names is None:
            raise ValueError("feature_names не установлены")

        available_features = [f for f in self.feature_names if f in df.columns]
        if not available_features:
            stripped = {c.strip(): c for c in df.columns}
            available_features = []
            for f in self.feature_names:
                if f.strip() in stripped:
                    available_features.append(stripped[f.strip()])

        X = df[available_features].values.astype(np.float32)
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)

        if self.scaler is not None:
            X = self.scaler.transform(X)

        return self.predict(X)

    @classmethod
    def load(cls, models_dir: str, classifier_name: str = 'xgboost') -> 'IDSPipeline':
        """
        Загрузить pipeline из сохранённых моделей.

        Uses NumPy-based inference (no PyTorch needed at runtime).
        """
        scaler = joblib.load(os.path.join(models_dir, 'scaler.pkl'))
        label_encoder = joblib.load(os.path.join(models_dir, 'label_encoder.pkl'))
        feature_names = joblib.load(os.path.join(models_dir, 'feature_names.pkl'))

        # NumPy autoencoder (from .npz)
        ae_path = os.path.join(models_dir, 'autoencoder.npz')
        anomaly_detector = NumpyAutoencoder(ae_path)

        # Classifier
        clf_lower = classifier_name.lower().replace(' ', '_')
        if clf_lower == 'mlp':
            mlp_path = os.path.join(models_dir, 'mlp.npz')
            classifier = NumpyMLP(mlp_path)
        else:
            pkl_path = os.path.join(models_dir, f'{clf_lower}.pkl')
            classifier = joblib.load(pkl_path)

        return cls(
            anomaly_detector=anomaly_detector,
            classifier=classifier,
            classifier_name=classifier_name,
            label_encoder=label_encoder,
            scaler=scaler,
            feature_names=feature_names,
        )
