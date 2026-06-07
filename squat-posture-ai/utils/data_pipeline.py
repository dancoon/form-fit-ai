from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Tuple

import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from utils.config import Config
class DataPipeline:
    """Handles train/val/test splitting and normalization."""

    def __init__(self, config: Config):
        self.cfg = config
        self.scaler = StandardScaler()

    def split_data(self, X: np.ndarray, y: np.ndarray,
                   y_errors: np.ndarray) -> Dict[str, np.ndarray]:
        """Split into train/val/test with stratification."""
        X_temp, X_test, y_temp, y_test, ye_temp, ye_test = train_test_split(
            X, y, y_errors,
            test_size=self.cfg.test_size,
            random_state=self.cfg.random_state,
            stratify=y
        )

        val_ratio = self.cfg.val_size / (1 - self.cfg.test_size)
        X_train, X_val, y_train, y_val, ye_train, ye_val = train_test_split(
            X_temp, y_temp, ye_temp,
            test_size=val_ratio,
            random_state=self.cfg.random_state,
            stratify=y_temp
        )

        return {
            'X_train': X_train, 'y_train': y_train, 'ye_train': ye_train,
            'X_val': X_val, 'y_val': y_val, 'ye_val': ye_val,
            'X_test': X_test, 'y_test': y_test, 'ye_test': ye_test,
        }

    def normalize_sequences(self, splits: Dict[str, np.ndarray]) -> Dict[str, np.ndarray]:
        """Fit scaler on train and transform all splits."""
        X_train = splits['X_train']
        n_samples, seq_len, n_features = X_train.shape

        # Fit on training data (reshape to 2D for scaler)
        train_flat = X_train.reshape(-1, n_features)
        self.scaler.fit(train_flat)

        # Transform all splits
        for key in ['X_train', 'X_val', 'X_test']:
            data = splits[key]
            n = data.shape[0]
            flat = data.reshape(-1, n_features)
            normalized = self.scaler.transform(flat)
            splits[key] = normalized.reshape(n, seq_len, n_features)

        return splits

    def export_feature_scaler(self, output_path: str | Path) -> Path:
        """Export fitted StandardScaler for mobile inference."""
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        scaler_export = {
            "mean": self.scaler.mean_.tolist(),
            "scale": self.scaler.scale_.tolist(),
            "sequence_length": self.cfg.sequence_length,
            "features_per_frame": self.cfg.num_engineered_features,
        }
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(scaler_export, f, indent=2)
        return output_path
