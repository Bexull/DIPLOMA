"""
Автоэнкодер для обнаружения аномалий в сетевом трафике.

Обучается только на нормальном трафике. Атаки обнаруживаются
по высокой ошибке реконструкции (reconstruction error).
"""

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import roc_auc_score, precision_recall_curve, f1_score
from typing import Tuple, Optional
import os


class Autoencoder(nn.Module):
    """
    Автоэнкодер для обнаружения аномалий.

    Архитектура:
    Encoder: input → 32 → 16 → 8 (bottleneck)
    Decoder: 8 → 16 → 32 → input

    Обучается минимизировать MSE между входом и выходом
    на нормальном трафике. Аномалии дают высокий MSE.
    """

    def __init__(self, input_dim: int):
        super().__init__()
        self.input_dim = input_dim

        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.BatchNorm1d(32),
            nn.Dropout(0.2),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.BatchNorm1d(16),
            nn.Linear(16, 8),
            nn.ReLU(),
        )

        self.decoder = nn.Sequential(
            nn.Linear(8, 16),
            nn.ReLU(),
            nn.BatchNorm1d(16),
            nn.Dropout(0.2),
            nn.Linear(16, 32),
            nn.ReLU(),
            nn.BatchNorm1d(32),
            nn.Linear(32, input_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded

    def get_reconstruction_error(self, x: torch.Tensor) -> torch.Tensor:
        """Вычислить ошибку реконструкции (MSE) для каждого сэмпла."""
        self.eval()
        with torch.no_grad():
            reconstructed = self.forward(x)
            error = torch.mean((x - reconstructed) ** 2, dim=1)
        return error


class AnomalyDetector:
    """
    Обёртка над автоэнкодером для обнаружения аномалий.

    Подбирает оптимальный порог ошибки реконструкции
    для разделения нормального трафика и атак.
    """

    def __init__(self, input_dim: int, device: Optional[str] = None):
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = Autoencoder(input_dim).to(self.device)
        self.threshold = None
        self.train_losses = []

    def train(
        self,
        X_normal: np.ndarray,
        epochs: int = 50,
        batch_size: int = 256,
        lr: float = 1e-3,
        validation_split: float = 0.1,
    ) -> dict:
        """
        Обучить автоэнкодер на нормальном трафике.

        Args:
            X_normal: массив ТОЛЬКО нормального трафика
            epochs: количество эпох
            batch_size: размер батча
            lr: learning rate
            validation_split: доля валидации

        Returns:
            dict с историей обучения
        """
        # Разделение на train/val
        n_val = int(len(X_normal) * validation_split)
        indices = np.random.permutation(len(X_normal))
        train_idx, val_idx = indices[n_val:], indices[:n_val]

        X_train_t = torch.FloatTensor(X_normal[train_idx]).to(self.device)
        X_val_t = torch.FloatTensor(X_normal[val_idx]).to(self.device)

        train_dataset = TensorDataset(X_train_t, X_train_t)
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, patience=5, factor=0.5
        )
        criterion = nn.MSELoss()

        self.model.train()
        history = {'train_loss': [], 'val_loss': []}

        for epoch in range(epochs):
            epoch_loss = 0
            n_batches = 0

            for batch_x, _ in train_loader:
                optimizer.zero_grad()
                output = self.model(batch_x)
                loss = criterion(output, batch_x)
                loss.backward()
                optimizer.step()
                epoch_loss += loss.item()
                n_batches += 1

            avg_train_loss = epoch_loss / n_batches

            # Валидационная ошибка
            self.model.eval()
            with torch.no_grad():
                val_output = self.model(X_val_t)
                val_loss = criterion(val_output, X_val_t).item()
            self.model.train()

            history['train_loss'].append(avg_train_loss)
            history['val_loss'].append(val_loss)

            scheduler.step(val_loss)

            if (epoch + 1) % 10 == 0:
                print(
                    f"Epoch {epoch+1}/{epochs} — "
                    f"Train Loss: {avg_train_loss:.6f}, "
                    f"Val Loss: {val_loss:.6f}"
                )

        self.train_losses = history['train_loss']
        return history

    def find_threshold(
        self,
        X_test: np.ndarray,
        y_test_binary: np.ndarray,
    ) -> float:
        """
        Подобрать оптимальный порог по F1-score на тестовых данных.

        Args:
            X_test: тестовые данные (нормальные + атаки)
            y_test_binary: бинарные метки (0=норма, 1=атака)

        Returns:
            Оптимальный порог
        """
        errors = self._compute_errors(X_test)

        # Подбор порога через precision-recall curve
        precision, recall, thresholds = precision_recall_curve(
            y_test_binary, errors
        )

        # F1 для каждого порога
        f1_scores = 2 * (precision * recall) / (precision + recall + 1e-8)
        best_idx = np.argmax(f1_scores)
        self.threshold = thresholds[min(best_idx, len(thresholds) - 1)]

        print(f"Оптимальный порог: {self.threshold:.6f}")
        print(f"F1 при этом пороге: {f1_scores[best_idx]:.4f}")

        return self.threshold

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Предсказать: 0 = нормально, 1 = аномалия."""
        if self.threshold is None:
            raise ValueError("Порог не установлен. Вызовите find_threshold().")
        errors = self._compute_errors(X)
        return (errors > self.threshold).astype(int)

    def predict_scores(self, X: np.ndarray) -> np.ndarray:
        """Вернуть ошибки реконструкции (чем выше — тем вероятнее атака)."""
        return self._compute_errors(X)

    def evaluate(self, X_test: np.ndarray, y_test_binary: np.ndarray) -> dict:
        """Вычислить метрики на тестовых данных."""
        errors = self._compute_errors(X_test)
        predictions = self.predict(X_test)

        auc = roc_auc_score(y_test_binary, errors)
        f1 = f1_score(y_test_binary, predictions)

        from sklearn.metrics import accuracy_score, precision_score, recall_score
        acc = accuracy_score(y_test_binary, predictions)
        prec = precision_score(y_test_binary, predictions)
        rec = recall_score(y_test_binary, predictions)

        metrics = {
            'accuracy': acc,
            'precision': prec,
            'recall': rec,
            'f1': f1,
            'roc_auc': auc,
            'threshold': self.threshold,
        }

        print(f"\nAutoencoder метрики:")
        for k, v in metrics.items():
            print(f"  {k}: {v:.4f}")

        return metrics

    def save(self, path: str):
        """Сохранить модель и порог."""
        torch.save({
            'model_state_dict': self.model.state_dict(),
            'input_dim': self.model.input_dim,
            'threshold': self.threshold,
        }, path)
        print(f"Модель сохранена: {path}")

    def load(self, path: str):
        """Загрузить модель и порог."""
        checkpoint = torch.load(path, map_location=self.device, weights_only=False)
        self.model = Autoencoder(checkpoint['input_dim']).to(self.device)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.threshold = checkpoint['threshold']
        self.model.eval()
        print(f"Модель загружена: {path}")

    def _compute_errors(self, X: np.ndarray) -> np.ndarray:
        """Вычислить ошибки реконструкции для массива."""
        self.model.eval()
        X_tensor = torch.FloatTensor(X).to(self.device)

        errors = []
        batch_size = 1024
        for i in range(0, len(X_tensor), batch_size):
            batch = X_tensor[i:i + batch_size]
            batch_errors = self.model.get_reconstruction_error(batch)
            errors.append(batch_errors.cpu().numpy())

        return np.concatenate(errors)
