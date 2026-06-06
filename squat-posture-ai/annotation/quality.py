"""Quality checks for exported annotation datasets."""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

log = logging.getLogger("squat-annotate")


def run_quality_checks(path: str | Path | None) -> bool:
    """Verify exported data integrity. Returns True when all checks pass."""
    if not path or not Path(path).exists():
        log.warning("No exported data to check")
        return False

    data = np.load(path, allow_pickle=True)
    sequences = data["sequences"]
    labels = data["labels"]
    error_vectors = data["error_vectors"]

    log.info("Quality checks — %s", path)

    assert sequences.ndim == 3
    assert sequences.shape[2] == 132
    assert len(labels) == len(sequences)
    assert error_vectors.shape[1] == 3
    log.info("  shape OK — %s", sequences.shape)

    nan_count = int(np.isnan(sequences).sum())
    assert nan_count == 0
    log.info("  no NaNs")

    visibility = sequences[:, :, 3::4]
    log.info("  avg visibility: %.3f", visibility.mean())

    correct_pct = np.mean(labels == 0) * 100
    log.info("  balance: %.0f%% correct, %.0f%% incorrect", correct_pct, 100 - correct_pct)
    log.info("Dataset ready for training")
    return True
