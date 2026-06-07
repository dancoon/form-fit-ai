from __future__ import annotations

from typing import List

from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

from utils.model_profiles import ResolvedModelProfile

def get_training_callbacks(profile: ResolvedModelProfile, model_name: str) -> List:
    """Training callbacks shared by TrainingPipeline."""
    _ = model_name
    return [
        EarlyStopping(
            monitor='val_classification_accuracy',
            patience=profile.patience,
            restore_best_weights=True,
            mode='max',
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=7,
            min_lr=1e-6,
        ),
    ]
