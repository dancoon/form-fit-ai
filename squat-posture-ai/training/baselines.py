from __future__ import annotations

from typing import Dict

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
import xgboost as xgb

from utils.config import Config
class BaselineModels:
    """Traditional ML baselines operating on flattened/aggregated features."""

    def __init__(self, config: Config):
        self.cfg = config

    def _aggregate_sequences(self, X: np.ndarray) -> np.ndarray:
        """Aggregate temporal sequences into fixed-length feature vectors.

        Computes mean, std, min, max, and range for each feature across time.
        """
        stats = []
        stats.append(np.mean(X, axis=1))
        stats.append(np.std(X, axis=1))
        stats.append(np.min(X, axis=1))
        stats.append(np.max(X, axis=1))
        stats.append(np.max(X, axis=1) - np.min(X, axis=1))  # range
        return np.concatenate(stats, axis=1)

    def train_and_evaluate(self, splits: Dict[str, np.ndarray]) -> Dict[str, Dict]:
        """Train all baseline models and return metrics."""
        X_train_agg = self._aggregate_sequences(splits['X_train'])
        X_val_agg = self._aggregate_sequences(splits['X_val'])
        X_test_agg = self._aggregate_sequences(splits['X_test'])

        y_train = splits['y_train']
        y_test = splits['y_test']

        models = {
            'LogisticRegression': LogisticRegression(
                max_iter=1000, random_state=self.cfg.random_state, C=1.0
            ),
            'RandomForest': RandomForestClassifier(
                n_estimators=200, max_depth=15,
                random_state=self.cfg.random_state, n_jobs=-1
            ),
            'XGBoost': xgb.XGBClassifier(
                n_estimators=200, max_depth=8, learning_rate=0.1,
                random_state=self.cfg.random_state, use_label_encoder=False,
                eval_metric='logloss'
            ),
        }

        results = {}
        for name, model in models.items():
            print(f"  Training {name}...")
            start_time = time.time()
            model.fit(X_train_agg, y_train)
            train_time = time.time() - start_time

            # Inference timing
            start_time = time.time()
            y_pred = model.predict(X_test_agg)
            inference_time = (time.time() - start_time) / len(X_test_agg)

            y_prob = model.predict_proba(X_test_agg)[:, 1]

            results[name] = {
                'model': model,
                'y_pred': y_pred,
                'y_prob': y_prob,
                'accuracy': accuracy_score(y_test, y_pred),
                'precision': precision_score(y_test, y_pred, average='weighted'),
                'recall': recall_score(y_test, y_pred, average='weighted'),
                'f1': f1_score(y_test, y_pred, average='weighted'),
                'roc_auc': roc_auc_score(y_test, y_prob),
                'train_time': train_time,
                'inference_latency_ms': inference_time * 1000,
                'params': 'N/A',
            }
            print(f"    Accuracy: {results[name]['accuracy']:.4f} | "
                  f"F1: {results[name]['f1']:.4f} | "
                  f"AUC: {results[name]['roc_auc']:.4f}")

        return results


print("Training baseline ML models...")
baselines = BaselineModels(cfg)
baseline_results = baselines.train_and_evaluate(splits)
