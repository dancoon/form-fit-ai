from __future__ import annotations

from tensorflow import keras
from tensorflow.keras import Model

from utils.config import Config

def compile_multitask_model(model: Model, config: Config) -> Model:
    """Compile model with multi-task classification + error heads."""
    model.compile(
        optimizer=keras.optimizers.Adam(
            learning_rate=config.learning_rate,
            clipnorm=config.gradient_clip_norm,
        ),
        loss={
            'classification': 'binary_crossentropy',
            'error_detection': 'binary_crossentropy',
        },
        loss_weights={
            'classification': config.cls_loss_weight,
            'error_detection': config.err_loss_weight,
        },
        metrics={
            'classification': ['accuracy'],
            'error_detection': ['accuracy'],
        },
    )
    return model

def smooth_labels(y, config: Config):
    import numpy as np
    s = config.label_smoothing
    if s <= 0:
        return y.astype(np.float32)
    return y.astype(np.float32) * (1.0 - s) + 0.5 * s
