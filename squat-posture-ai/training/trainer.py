from __future__ import annotations

import time
from typing import Dict, List

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import Model

from training.callbacks import get_training_callbacks
from utils.config import Config
from utils.model_profiles import ResolvedModelProfile
class TrainingPipeline:
    """Unified training pipeline for all deep learning models."""

    def __init__(self, config: Config):
        self.cfg = config
        self.histories = {}
        self.trained_models = {}

    def _classification_targets(
        self,
        y: np.ndarray,
        *,
        smooth: bool,
        label_smoothing: float | None = None,
    ) -> np.ndarray:
        """Format class labels for the sigmoid head.

        Smoothing is training-only: applying it to validation breaks Keras
        binary accuracy (soft targets never equal thresholded predictions).
        """
        targets = y.astype(np.float32).reshape(-1, 1)
        if not smooth:
            return targets
        s = self.cfg.label_smoothing if label_smoothing is None else label_smoothing
        if s <= 0:
            return targets
        return targets * (1.0 - s) + 0.5 * s

    def compile_model(self, model: Model, profile: ResolvedModelProfile) -> Model:
        """Compile model with multi-task losses."""
        model.compile(
            optimizer=keras.optimizers.Adam(
                learning_rate=profile.learning_rate,
                clipnorm=self.cfg.gradient_clip_norm
            ),
            loss={
                'classification': 'binary_crossentropy',
                'error_detection': 'binary_crossentropy',
            },
            loss_weights={
                'classification': self.cfg.cls_loss_weight,
                'error_detection': self.cfg.err_loss_weight,
            },
            metrics={
                'classification': ['accuracy'],
                'error_detection': ['accuracy'],
            }
        )
        return model

    def get_callbacks(self, profile: ResolvedModelProfile, model_name: str) -> List:
        """Get training callbacks."""
        return get_training_callbacks(profile, model_name)

    def train_model(self, model: Model, model_name: str,
                    splits: Dict[str, np.ndarray]) -> Dict:
        """Train a single model and return results."""
        profile = self.cfg.get_model_profile(model_name)
        model = self.compile_model(model, profile)

        print(f"Training: {model_name}")
        print(f"  Profile: {profile.summary()}")
        print(f"Parameters: {model.count_params():,}")
        print(f"{'='*60}")

        y_train_cls = self._classification_targets(
            splits['y_train'],
            smooth=True,
            label_smoothing=profile.label_smoothing,
        )
        y_val_cls = self._classification_targets(splits['y_val'], smooth=False)

        start_time = time.time()
        history = model.fit(
            splits['X_train'],
            {
                'classification': y_train_cls,
                'error_detection': splits['ye_train'],
            },
            validation_data=(
                splits['X_val'],
                {
                    'classification': y_val_cls,
                    'error_detection': splits['ye_val'],
                }
            ),
            epochs=profile.epochs,
            batch_size=profile.batch_size,
            callbacks=self.get_callbacks(profile, model_name),
            verbose=0
        )
        train_time = time.time() - start_time

        self.histories[model_name] = history.history
        self.trained_models[model_name] = model

        # Inference latency measurement
        test_sample = splits['X_test'][:1]
        latencies = []
        for _ in range(50):
            t0 = time.time()
            _ = model.predict(test_sample, verbose=0)
            latencies.append((time.time() - t0) * 1000)
        avg_latency = np.mean(latencies[5:])  # skip warmup

        print(f"  Training time: {train_time:.1f}s")
        print(f"  Best val accuracy: {max(history.history['val_classification_accuracy']):.4f}")
        print(f"  Inference latency: {avg_latency:.2f}ms")

        return {
            'model': model,
            'history': history.history,
            'train_time': train_time,
            'inference_latency_ms': avg_latency,
            'params': model.count_params(),
        }

    def train_all(self, models: Dict[str, Model],
                  splits: Dict[str, np.ndarray]) -> Dict[str, Dict]:
        """Train all models sequentially."""
        results = {}
        for name, model in models.items():
            results[name] = self.train_model(model, name, splits)
        return results
