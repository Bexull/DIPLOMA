"""
Классификаторы для определения типа сетевой атаки.

Реализованы: Random Forest, XGBoost, LightGBM, MLP (PyTorch).
Все модели обучаются на мультиклассовую классификацию.
"""

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, classification_report,
    confusion_matrix,
)
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
import joblib
import os
from typing import Optional


class MLPClassifier(nn.Module):
    """Полносвязная нейросеть для классификации типов атак."""

    def __init__(self, input_dim: int, n_classes: int):
        super().__init__()
        self.input_dim = input_dim
        self.n_classes = n_classes

        self.network = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.BatchNorm1d(128),
            nn.Dropout(0.3),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.BatchNorm1d(64),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.BatchNorm1d(32),
            nn.Linear(32, n_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)


class MLPWrapper:
    """Обёртка для MLP с scikit-learn-совместимым интерфейсом."""

    def __init__(
        self,
        input_dim: int,
        n_classes: int,
        device: Optional[str] = None,
    ):
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = MLPClassifier(input_dim, n_classes).to(self.device)
        self.input_dim = input_dim
        self.n_classes = n_classes

    def fit(
        self,
        X: np.ndarray,
        y: np.ndarray,
        epochs: int = 30,
        batch_size: int = 256,
        lr: float = 1e-3,
    ) -> dict:
        """Обучить MLP."""
        X_tensor = torch.FloatTensor(X).to(self.device)
        y_tensor = torch.LongTensor(y).to(self.device)

        dataset = TensorDataset(X_tensor, y_tensor)
        loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, patience=3, factor=0.5
        )
        criterion = nn.CrossEntropyLoss()

        self.model.train()
        history = {'loss': []}

        for epoch in range(epochs):
            epoch_loss = 0
            n_batches = 0

            for batch_x, batch_y in loader:
                optimizer.zero_grad()
                output = self.model(batch_x)
                loss = criterion(output, batch_y)
                loss.backward()
                optimizer.step()
                epoch_loss += loss.item()
                n_batches += 1

            avg_loss = epoch_loss / n_batches
            history['loss'].append(avg_loss)
            scheduler.step(avg_loss)

            if (epoch + 1) % 10 == 0:
                print(f"  MLP Epoch {epoch+1}/{epochs} — Loss: {avg_loss:.4f}")

        return history

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Предсказать классы."""
        self.model.eval()
        X_tensor = torch.FloatTensor(X).to(self.device)

        predictions = []
        batch_size = 1024
        with torch.no_grad():
            for i in range(0, len(X_tensor), batch_size):
                batch = X_tensor[i:i + batch_size]
                output = self.model(batch)
                preds = torch.argmax(output, dim=1)
                predictions.append(preds.cpu().numpy())

        return np.concatenate(predictions)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Предсказать вероятности классов."""
        self.model.eval()
        X_tensor = torch.FloatTensor(X).to(self.device)

        probas = []
        batch_size = 1024
        with torch.no_grad():
            for i in range(0, len(X_tensor), batch_size):
                batch = X_tensor[i:i + batch_size]
                output = self.model(batch)
                proba = torch.softmax(output, dim=1)
                probas.append(proba.cpu().numpy())

        return np.concatenate(probas)

    def save(self, path: str):
        """Сохранить модель."""
        torch.save({
            'model_state_dict': self.model.state_dict(),
            'input_dim': self.input_dim,
            'n_classes': self.n_classes,
        }, path)

    def load(self, path: str):
        """Загрузить модель."""
        checkpoint = torch.load(path, map_location=self.device, weights_only=False)
        self.model = MLPClassifier(
            checkpoint['input_dim'], checkpoint['n_classes']
        ).to(self.device)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model.eval()


def create_classifiers(input_dim: int, n_classes: int) -> dict:
    """
    Создать все классификаторы.

    Returns:
        dict: {name: classifier_instance}
    """
    return {
        'Random Forest': RandomForestClassifier(
            n_estimators=100,
            max_depth=20,
            min_samples_split=5,
            n_jobs=-1,
            random_state=42,
        ),
        'XGBoost': XGBClassifier(
            n_estimators=100,
            max_depth=10,
            learning_rate=0.1,
            n_jobs=-1,
            random_state=42,
            eval_metric='mlogloss',
        ),
        'LightGBM': LGBMClassifier(
            n_estimators=100,
            max_depth=15,
            learning_rate=0.1,
            n_jobs=-1,
            random_state=42,
            verbose=-1,
        ),
        'MLP': MLPWrapper(input_dim, n_classes),
    }


def train_classifier(name: str, clf, X_train: np.ndarray, y_train: np.ndarray):
    """Обучить один классификатор."""
    print(f"\nОбучение: {name}...")
    if isinstance(clf, MLPWrapper):
        clf.fit(X_train, y_train)
    else:
        clf.fit(X_train, y_train)
    print(f"  {name} — обучен.")


def evaluate_classifier(
    name: str,
    clf,
    X_test: np.ndarray,
    y_test: np.ndarray,
    class_names: list,
) -> dict:
    """
    Оценить классификатор.

    Returns:
        dict с метриками
    """
    if isinstance(clf, MLPWrapper):
        y_pred = clf.predict(X_test)
        y_proba = clf.predict_proba(X_test)
    else:
        y_pred = clf.predict(X_test)
        y_proba = clf.predict_proba(X_test) if hasattr(clf, 'predict_proba') else None

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, average='weighted', zero_division=0)
    rec = recall_score(y_test, y_pred, average='weighted', zero_division=0)
    f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
    f1_macro = f1_score(y_test, y_pred, average='macro', zero_division=0)

    # ROC AUC (one-vs-rest)
    auc = None
    if y_proba is not None:
        try:
            auc = roc_auc_score(y_test, y_proba, multi_class='ovr', average='weighted')
        except ValueError:
            auc = None

    metrics = {
        'accuracy': acc,
        'precision': prec,
        'recall': rec,
        'f1_weighted': f1,
        'f1_macro': f1_macro,
        'roc_auc': auc,
    }

    cm = confusion_matrix(y_test, y_pred)
    report = classification_report(y_test, y_pred, target_names=class_names, zero_division=0)

    print(f"\n{'='*50}")
    print(f"Результаты: {name}")
    print(f"{'='*50}")
    print(f"  Accuracy:  {acc:.4f}")
    print(f"  Precision: {prec:.4f}")
    print(f"  Recall:    {rec:.4f}")
    print(f"  F1 (weighted): {f1:.4f}")
    print(f"  F1 (macro):    {f1_macro:.4f}")
    if auc is not None:
        print(f"  ROC AUC:   {auc:.4f}")
    print(f"\nClassification Report:\n{report}")

    return {
        'metrics': metrics,
        'confusion_matrix': cm.tolist(),
        'classification_report': report,
        'predictions': y_pred,
    }


def save_classifier(name: str, clf, models_dir: str):
    """Сохранить классификатор."""
    if isinstance(clf, MLPWrapper):
        path = os.path.join(models_dir, f'{name.lower().replace(" ", "_")}.pt')
        clf.save(path)
    else:
        path = os.path.join(models_dir, f'{name.lower().replace(" ", "_")}.pkl')
        joblib.dump(clf, path)
    print(f"Сохранён: {path}")


def load_classifier(name: str, models_dir: str, input_dim: int = 0, n_classes: int = 0):
    """Загрузить классификатор."""
    if name == 'MLP':
        path = os.path.join(models_dir, 'mlp.pt')
        clf = MLPWrapper(input_dim, n_classes)
        clf.load(path)
        return clf
    else:
        filename = name.lower().replace(" ", "_") + '.pkl'
        path = os.path.join(models_dir, filename)
        return joblib.load(path)
