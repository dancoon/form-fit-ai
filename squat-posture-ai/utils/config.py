from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum

class SquatError(Enum):
    CORRECT = 0
    KNEE_VALGUS = 1
    INSUFFICIENT_DEPTH = 2
    FORWARD_LEAN = 3


@dataclass
class Config:
    """Central configuration for the entire pipeline."""
    # BlazePose
    num_landmarks: int = 33
    coords_per_landmark: int = 4  # x, y, z, visibility
    raw_feature_dim: int = 33 * 4  # 132

    # Sequence modeling — MUST match mobile SQUAT_SEQUENCE_LENGTH when exporting TFLite
    sequence_length: int = 45
    sequence_stride: int = 5
    min_sequence_length: int = 45  # fixed length for training (matches on-device resampling)
    max_sequence_length: int = 45

    # Engineered features
    num_joint_angles: int = 10
    num_symmetry_features: int = 4
    num_dynamics_features: int = 8
    num_engineered_features: int = 22  # total per frame

    # Dataset (larger + harder negatives → less "100% on synthetic" overfitting)
    num_samples: int = 6000
    num_classes: int = 2  # correct / incorrect
    num_error_types: int = 3  # knee_valgus, insufficient_depth, forward_lean
    test_size: float = 0.15
    val_size: float = 0.15
    random_state: int = 42
    # Extra near-boundary "hard" sequences mixed into training
    hard_negative_fraction: float = 0.12
    pose_noise_scale: float = 0.006
    mirror_augment_prob: float = 0.5

    # Training
    batch_size: int = 32
    epochs: int = 80
    learning_rate: float = 5e-4
    dropout_rate: float = 0.35
    patience: int = 12
    gradient_clip_norm: float = 1.0
    label_smoothing: float = 0.05
    cls_loss_weight: float = 1.0
    err_loss_weight: float = 0.65

    # Model
    hidden_units: int = 64
    num_attention_heads: int = 4
    transformer_ff_dim: int = 128
    num_transformer_blocks: int = 2

    # Paths
    model_dir: str = './models'
    tflite_dir: str = './tflite_models'
    results_dir: str = './results'

    def __post_init__(self):
        os.makedirs(self.model_dir, exist_ok=True)
        os.makedirs(self.tflite_dir, exist_ok=True)
        os.makedirs(self.results_dir, exist_ok=True)


@dataclass
class PoseLandmarks:
    """BlazePose landmark indices relevant to squat analysis."""
    LEFT_SHOULDER: int = 11
    RIGHT_SHOULDER: int = 12
    LEFT_HIP: int = 23
    RIGHT_HIP: int = 24
    LEFT_KNEE: int = 25
    RIGHT_KNEE: int = 26
    LEFT_ANKLE: int = 27
    RIGHT_ANKLE: int = 28
    LEFT_HEEL: int = 29
    RIGHT_HEEL: int = 30
    LEFT_FOOT_INDEX: int = 31
    RIGHT_FOOT_INDEX: int = 32
    NOSE: int = 0
    LEFT_EAR: int = 7
    RIGHT_EAR: int = 8

LM = PoseLandmarks()
