from __future__ import annotations

from pathlib import Path
from typing import Dict

import numpy as np
from tqdm import tqdm

from utils.augmentation import expand_training_set
from utils.biomechanics import BiomechanicsEngine
from utils.config import Config
from utils.data_pipeline import DataPipeline
from utils.temporal import TemporalProcessor


def resolve_annotated_dataset_path(cfg: Config) -> Path:
    """Return the first existing annotated dataset path."""
    candidates = [
        Path(cfg.annotated_data_path),
        Path("data/annotated/annotated_dataset.npz"),
        Path("annotated_data/annotated_dataset.npz"),
    ]
    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError(
        "Annotated dataset not found. Export it first:\n"
        "  python run_annotation.py export --check\n"
        f"Expected one of: {', '.join(str(p) for p in candidates)}"
    )


def load_annotated_dataset(path: str | Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Load sequences, labels, and error vectors from annotated_dataset.npz."""
    data = np.load(path, allow_pickle=True)
    raw_sequences = data["sequences"]
    labels = data["labels"]
    error_vectors = data["error_vectors"]
    return raw_sequences, labels, error_vectors


def extract_feature_sequences(
    raw_sequences: np.ndarray,
    *,
    show_progress: bool = True,
    desc: str = "Feature extraction",
) -> np.ndarray:
    """Interpolate, extract biomechanical features, and smooth each sequence."""
    biomech = BiomechanicsEngine()
    temporal_proc = TemporalProcessor()

    iterator = range(len(raw_sequences))
    if show_progress and len(raw_sequences) > 0:
        iterator = tqdm(iterator, desc=desc)

    feature_sequences = []
    for i in iterator:
        clean_seq = temporal_proc.interpolate_missing(raw_sequences[i])
        feat_seq = biomech.extract_sequence_features(clean_seq)
        feat_seq = temporal_proc.smooth_sequence(feat_seq)
        feature_sequences.append(feat_seq)

    if not feature_sequences:
        return np.zeros((0, 45, 22), dtype=np.float32)
    return np.array(feature_sequences, dtype=np.float32)


def prepare_training_splits(cfg: Config) -> tuple[Dict[str, np.ndarray], DataPipeline]:
    """Load annotated data, augment train only, extract features, normalize."""
    path = resolve_annotated_dataset_path(cfg)
    raw_sequences, labels, error_vectors = load_annotated_dataset(path)

    print(f"Loaded: {raw_sequences.shape[0]} annotated sequences from {path}")
    print(f"Shape: {raw_sequences.shape}")
    print(
        f"Labels distribution: correct={np.sum(labels == 0)}, "
        f"incorrect={np.sum(labels == 1)}"
    )
    print(
        f"Error types: knee_valgus={np.sum(error_vectors[:, 0])}, "
        f"insufficient_depth={np.sum(error_vectors[:, 1])}, "
        f"forward_lean={np.sum(error_vectors[:, 2])}"
    )

    pipeline = DataPipeline(cfg)
    raw_splits = pipeline.split_data(raw_sequences, labels, error_vectors)

    train_raw = raw_splits["X_train"]
    train_labels = raw_splits["y_train"]
    train_errors = raw_splits["ye_train"]
    n_train_before = len(train_raw)

    rng = np.random.default_rng(cfg.random_state)
    train_raw, train_labels, train_errors = expand_training_set(
        train_raw, train_labels, train_errors, cfg, rng
    )

    if cfg.enable_train_augmentation:
        print(
            f"Training augmentation: {n_train_before} -> {len(train_raw)} sequences "
            f"(mirror={cfg.mirror_augment_prob:.0%}, "
            f"jitter={cfg.jitter_augment_prob:.0%}, "
            f"time_warp={cfg.time_warp_augment_prob:.0%})"
        )

    print("Extracting biomechanical features from raw sequences...")
    feature_splits = {
        "X_train": extract_feature_sequences(
            train_raw, desc="Feature extraction (train)"
        ),
        "X_val": extract_feature_sequences(
            raw_splits["X_val"], show_progress=False
        ),
        "X_test": extract_feature_sequences(
            raw_splits["X_test"], show_progress=False
        ),
        "y_train": train_labels,
        "y_val": raw_splits["y_val"],
        "y_test": raw_splits["y_test"],
        "ye_train": train_errors,
        "ye_val": raw_splits["ye_val"],
        "ye_test": raw_splits["ye_test"],
    }
    print(f"Feature sequences shape: {feature_splits['X_train'].shape}")
    print(f"Features per frame: {feature_splits['X_train'].shape[2]}")

    return pipeline.normalize_sequences(feature_splits), pipeline


def load_training_data(cfg: Config) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Load annotated data and build engineered feature sequences (no split)."""
    path = resolve_annotated_dataset_path(cfg)
    raw_sequences, labels, error_vectors = load_annotated_dataset(path)

    print(f"Loaded: {raw_sequences.shape[0]} annotated sequences from {path}")
    print(f"Shape: {raw_sequences.shape}")
    print(
        f"Labels distribution: correct={np.sum(labels == 0)}, "
        f"incorrect={np.sum(labels == 1)}"
    )
    print(
        f"Error types: knee_valgus={np.sum(error_vectors[:, 0])}, "
        f"insufficient_depth={np.sum(error_vectors[:, 1])}, "
        f"forward_lean={np.sum(error_vectors[:, 2])}"
    )

    print("Extracting biomechanical features from raw sequences...")
    feature_sequences = extract_feature_sequences(raw_sequences)
    print(f"Feature sequences shape: {feature_sequences.shape}")
    print(f"Features per frame: {feature_sequences.shape[2]}")

    return raw_sequences, feature_sequences, labels, error_vectors
