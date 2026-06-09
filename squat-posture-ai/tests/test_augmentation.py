from __future__ import annotations

import numpy as np

from utils.augmentation import (
    expand_training_set,
    jitter_sequence,
    mirror_sequence,
    time_warp_sequence,
)
from utils.config import Config


def _sample_sequence(length: int | None = None) -> np.ndarray:
    if length is None:
        length = Config().sequence_length
    seq = np.zeros((length, 132), dtype=np.float32)
    for lm in range(33):
        seq[:, lm * 4] = 0.4 + lm * 0.01
        seq[:, lm * 4 + 1] = 0.5
        seq[:, lm * 4 + 2] = 0.0
        seq[:, lm * 4 + 3] = 0.95
    return seq


def test_mirror_flips_x_coordinates():
    seq = _sample_sequence()
    mirrored = mirror_sequence(seq)
    assert np.allclose(mirrored[:, 0], 1.0 - seq[:, 0])
    assert np.allclose(mirrored[:, 3::4], seq[:, 3::4])


def test_jitter_preserves_visibility():
    seq = _sample_sequence()
    rng = np.random.default_rng(0)
    jittered = jitter_sequence(seq, rng, noise_scale=0.01)
    assert jittered.shape == seq.shape
    assert np.allclose(jittered[:, 3::4], seq[:, 3::4])


def test_time_warp_keeps_sequence_length():
    seq = _sample_sequence()
    rng = np.random.default_rng(1)
    warped = time_warp_sequence(
        seq, rng, speed_min=0.8, speed_max=1.2, target_length=Config().sequence_length
    )
    assert warped.shape == seq.shape


def test_expand_training_set_increases_train_size():
    cfg = Config(enable_train_augmentation=True)
    raw = np.stack([_sample_sequence(), _sample_sequence()], axis=0)
    labels = np.array([0, 1], dtype=np.int32)
    errors = np.array([[0, 0, 0], [1, 0, 0]], dtype=np.float32)

    expanded_raw, expanded_labels, expanded_errors = expand_training_set(
        raw, labels, errors, cfg, np.random.default_rng(42)
    )

    assert len(expanded_raw) >= len(raw)
    assert len(expanded_labels) == len(expanded_raw)
    assert len(expanded_errors) == len(expanded_raw)


def test_expand_training_set_disabled():
    cfg = Config(enable_train_augmentation=False)
    raw = np.stack([_sample_sequence()], axis=0)
    labels = np.array([0], dtype=np.int32)
    errors = np.array([[0, 0, 0]], dtype=np.float32)

    out_raw, out_labels, out_errors = expand_training_set(raw, labels, errors, cfg)
    assert len(out_raw) == 1
    assert out_labels[0] == 0
