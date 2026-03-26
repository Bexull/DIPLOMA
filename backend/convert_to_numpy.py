"""Convert PyTorch models (.pt) to NumPy (.npz) for lightweight inference."""

import torch
import numpy as np
import os

MODELS_DIR = os.path.join(os.path.dirname(__file__), 'app', 'models')


def convert_autoencoder():
    path = os.path.join(MODELS_DIR, 'autoencoder.pt')
    checkpoint = torch.load(path, map_location='cpu', weights_only=False)

    state = checkpoint['model_state_dict']
    arrays = {k: v.numpy() for k, v in state.items()}
    arrays['threshold'] = np.array([checkpoint['threshold']])
    arrays['input_dim'] = np.array([checkpoint['input_dim']])

    out = os.path.join(MODELS_DIR, 'autoencoder.npz')
    np.savez(out, **arrays)
    print(f"Saved {out} ({os.path.getsize(out)} bytes)")


def convert_mlp():
    path = os.path.join(MODELS_DIR, 'mlp.pt')
    checkpoint = torch.load(path, map_location='cpu', weights_only=False)

    state = checkpoint['model_state_dict']
    arrays = {k: v.numpy() for k, v in state.items()}
    arrays['input_dim'] = np.array([checkpoint['input_dim']])
    arrays['n_classes'] = np.array([checkpoint['n_classes']])

    out = os.path.join(MODELS_DIR, 'mlp.npz')
    np.savez(out, **arrays)
    print(f"Saved {out} ({os.path.getsize(out)} bytes)")


if __name__ == '__main__':
    convert_autoencoder()
    convert_mlp()
    print("Done!")
