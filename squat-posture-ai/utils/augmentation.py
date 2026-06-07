from __future__ import annotations

import numpy as np

from utils.config import Config
from utils.temporal import TemporalProcessor


def mirror_sequence(sequence: np.ndarray) -> np.ndarray:
    """Mirror pose horizontally (swap left/right in image space)."""
    mirrored = sequence.copy()
    mirrored[:, 0::4] = 1.0 - mirrored[:, 0::4]
    return mirrored.astype(np.float32)


def jitter_sequence(sequence: np.ndarray, rng: np.random.Generator,
                    noise_scale: float) -> np.ndarray:
    """Add small Gaussian noise to x/y/z (not visibility)."""
    jittered = sequence.copy()
    noise = rng.normal(0, noise_scale, jittered.shape)
    noise[:, 3::4] = 0
    return np.clip(jittered + noise, -0.2, 1.2).astype(np.float32)


def time_warp_sequence(
    sequence: np.ndarray,
    rng: np.random.Generator,
    *,
    speed_min: float,
    speed_max: float,
    target_length: int,
) -> np.ndarray:
    """Resample rep tempo by stretching/compressing then fixing sequence length."""
    n = len(sequence)
    speed = rng.uniform(speed_min, speed_max)
    virtual_len = max(n + 1, int(round(n * speed)))

    t_source = np.linspace(0, n - 1, virtual_len)
    virtual = np.zeros((virtual_len, sequence.shape[1]), dtype=np.float32)
    for i, t in enumerate(t_source):
        lower = int(np.floor(t))
        upper = min(lower + 1, n - 1)
        alpha = t - lower
        virtual[i] = (1 - alpha) * sequence[lower] + alpha * sequence[upper]

    resampler = TemporalProcessor()
    return resampler.normalize_sequence_length(virtual, target_length)


def augment_raw_sequence(
    sequence: np.ndarray,
    cfg: Config,
    rng: np.random.Generator,
    *,
    mirror: bool = False,
    jitter: bool = False,
    time_warp: bool = False,
) -> np.ndarray:
    """Apply selected pose-space augmentations to one raw sequence."""
    augmented = sequence.copy()

    if mirror:
        augmented = mirror_sequence(augmented)

    if jitter:
        augmented = jitter_sequence(augmented, rng, cfg.pose_noise_scale)

    if time_warp:
        augmented = time_warp_sequence(
            augmented,
            rng,
            speed_min=cfg.time_warp_speed_min,
            speed_max=cfg.time_warp_speed_max,
            target_length=cfg.sequence_length,
        )

    return augmented.astype(np.float32)


def expand_training_set(
    raw_sequences: np.ndarray,
    labels: np.ndarray,
    error_vectors: np.ndarray,
    cfg: Config,
    rng: np.random.Generator | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Duplicate training samples with stochastic mirror/jitter/time-warp variants."""
    if not cfg.enable_train_augmentation:
        return raw_sequences, labels, error_vectors

    rng = rng or np.random.default_rng(cfg.random_state)
    expanded_seq: list[np.ndarray] = []
    expanded_labels: list[int] = []
    expanded_errors: list[np.ndarray] = []

    augment_specs = (
        ("mirror", cfg.mirror_augment_prob),
        ("jitter", cfg.jitter_augment_prob),
        ("time_warp", cfg.time_warp_augment_prob),
    )

    for seq, label, err in zip(raw_sequences, labels, error_vectors):
        expanded_seq.append(seq)
        expanded_labels.append(int(label))
        expanded_errors.append(err)

        for name, prob in augment_specs:
            if rng.random() < prob:
                flags = {key: key == name for key, _ in augment_specs}
                expanded_seq.append(
                    augment_raw_sequence(seq, cfg, rng, **flags)
                )
                expanded_labels.append(int(label))
                expanded_errors.append(err)

    return (
        np.array(expanded_seq, dtype=np.float32),
        np.array(expanded_labels, dtype=np.int32),
        np.array(expanded_errors, dtype=np.float32),
    )
