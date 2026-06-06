from __future__ import annotations

from typing import Dict, List

import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import Model

from training.callbacks import get_training_callbacks
from training.losses import compile_multitask_model
from utils.config import Config
class TrainingPipeline:
    """Unified training pipeline for all deep learning models."""

    def __init__(self, config: Config):
        self.cfg = config
        self.histories = {}
        self.trained_models = {}

    def _smooth_labels(self, y: np.ndarray) -> np.ndarray:
        s = self.cfg.label_smoothing
        if s <= 0:
            return y.astype(np.float32)
        return y.astype(np.float32) * (1.0 - s) + 0.5 * s

    def compile_model(self, model: Model) -> Model:
        """Compile model with multi-task losses."""
        model.compile(
            optimizer=keras.optimizers.Adam(
                learning_rate=self.cfg.learning_rate,
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

    def get_callbacks(self, model_name: str) -> List:
        """Get training callbacks."""
        return [
            EarlyStopping(
                monitor='val_classification_accuracy',
                patience=self.cfg.patience,
                restore_best_weights=True,
                mode='max'
            ),
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=7,
                min_lr=1e-6
            ),
        ]

    def train_model(self, model: Model, model_name: str,
                    splits: Dict[str, np.ndarray]) -> Dict:
        """Train a single model and return results."""
        model = self.compile_model(model)

        print(f"Training: {model_name}")
        print(f"Parameters: {model.count_params():,}")
        print(f"{'='*60}")

        y_train_cls = self._smooth_labels(splits['y_train'])
        y_val_cls = self._smooth_labels(splits['y_val'])

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
            epochs=self.cfg.epochs,
            batch_size=self.cfg.batch_size,
            callbacks=self.get_callbacks(model_name),
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


dl_results = trainer.train_all(all_dl_models, splits)
