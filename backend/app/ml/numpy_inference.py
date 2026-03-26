"""
Lightweight NumPy-based inference for autoencoder and MLP.

Replaces PyTorch at runtime — same math, ~200MB less RAM.
Weights are loaded from .npz files converted from .pt checkpoints.
"""

import numpy as np
import os


def _relu(x):
    return np.maximum(0, x)


def _linear(x, weight, bias):
    return x @ weight.T + bias


def _batchnorm(x, running_mean, running_var, weight, bias, eps=1e-5):
    return (x - running_mean) / np.sqrt(running_var + eps) * weight + bias


def _softmax(x):
    e = np.exp(x - np.max(x, axis=-1, keepdims=True))
    return e / e.sum(axis=-1, keepdims=True)


class NumpyAutoencoder:
    """NumPy autoencoder for anomaly detection (inference only)."""

    def __init__(self, npz_path: str):
        data = np.load(npz_path)
        self.threshold = float(data['threshold'][0])
        self.input_dim = int(data['input_dim'][0])

        # Encoder layers
        self.enc_layers = [
            # Linear(input, 32) -> ReLU -> BatchNorm(32) -> [Dropout] ->
            ('linear', data['encoder.0.weight'], data['encoder.0.bias']),
            ('relu',),
            ('bn', data['encoder.2.running_mean'], data['encoder.2.running_var'],
             data['encoder.2.weight'], data['encoder.2.bias']),
            # Linear(32, 16) -> ReLU -> BatchNorm(16) ->
            ('linear', data['encoder.4.weight'], data['encoder.4.bias']),
            ('relu',),
            ('bn', data['encoder.6.running_mean'], data['encoder.6.running_var'],
             data['encoder.6.weight'], data['encoder.6.bias']),
            # Linear(16, 8) -> ReLU
            ('linear', data['encoder.7.weight'], data['encoder.7.bias']),
            ('relu',),
        ]

        # Decoder layers
        self.dec_layers = [
            # Linear(8, 16) -> ReLU -> BatchNorm(16) -> [Dropout] ->
            ('linear', data['decoder.0.weight'], data['decoder.0.bias']),
            ('relu',),
            ('bn', data['decoder.2.running_mean'], data['decoder.2.running_var'],
             data['decoder.2.weight'], data['decoder.2.bias']),
            # Linear(16, 32) -> ReLU -> BatchNorm(32) ->
            ('linear', data['decoder.4.weight'], data['decoder.4.bias']),
            ('relu',),
            ('bn', data['decoder.6.running_mean'], data['decoder.6.running_var'],
             data['decoder.6.weight'], data['decoder.6.bias']),
            # Linear(32, input)
            ('linear', data['decoder.7.weight'], data['decoder.7.bias']),
        ]

    def _forward_layers(self, x, layers):
        for layer in layers:
            if layer[0] == 'linear':
                x = _linear(x, layer[1], layer[2])
            elif layer[0] == 'relu':
                x = _relu(x)
            elif layer[0] == 'bn':
                x = _batchnorm(x, layer[1], layer[2], layer[3], layer[4])
        return x

    def reconstruction_error(self, X: np.ndarray) -> np.ndarray:
        encoded = self._forward_layers(X.astype(np.float32), self.enc_layers)
        decoded = self._forward_layers(encoded, self.dec_layers)
        return np.mean((X - decoded) ** 2, axis=1)

    def predict(self, X: np.ndarray) -> np.ndarray:
        errors = self.reconstruction_error(X)
        return (errors > self.threshold).astype(int)

    def predict_scores(self, X: np.ndarray) -> np.ndarray:
        return self.reconstruction_error(X)


class NumpyMLP:
    """NumPy MLP classifier (inference only)."""

    def __init__(self, npz_path: str):
        data = np.load(npz_path)
        self.input_dim = int(data['input_dim'][0])
        self.n_classes = int(data['n_classes'][0])

        self.layers = [
            # Linear(input, 128) -> ReLU -> BatchNorm(128) -> [Dropout] ->
            ('linear', data['network.0.weight'], data['network.0.bias']),
            ('relu',),
            ('bn', data['network.2.running_mean'], data['network.2.running_var'],
             data['network.2.weight'], data['network.2.bias']),
            # Linear(128, 64) -> ReLU -> BatchNorm(64) -> [Dropout] ->
            ('linear', data['network.4.weight'], data['network.4.bias']),
            ('relu',),
            ('bn', data['network.6.running_mean'], data['network.6.running_var'],
             data['network.6.weight'], data['network.6.bias']),
            # Linear(64, 32) -> ReLU -> BatchNorm(32) ->
            ('linear', data['network.8.weight'], data['network.8.bias']),
            ('relu',),
            ('bn', data['network.10.running_mean'], data['network.10.running_var'],
             data['network.10.weight'], data['network.10.bias']),
            # Linear(32, n_classes)
            ('linear', data['network.11.weight'], data['network.11.bias']),
        ]

    def _forward(self, x):
        for layer in self.layers:
            if layer[0] == 'linear':
                x = _linear(x, layer[1], layer[2])
            elif layer[0] == 'relu':
                x = _relu(x)
            elif layer[0] == 'bn':
                x = _batchnorm(x, layer[1], layer[2], layer[3], layer[4])
        return x

    def predict(self, X: np.ndarray) -> np.ndarray:
        logits = self._forward(X.astype(np.float32))
        return np.argmax(logits, axis=1)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        logits = self._forward(X.astype(np.float32))
        return _softmax(logits)
