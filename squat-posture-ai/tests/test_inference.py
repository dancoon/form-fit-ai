from __future__ import annotations

import numpy as np

from utils.config import Config
from utils.temporal import TemporalProcessor

def test_normalize_sequence_length():
    cfg = Config()
    proc = TemporalProcessor()
    seq = np.random.rand(30, cfg.num_engineered_features).astype(np.float32)
    out = proc.normalize_sequence_length(seq, cfg.sequence_length)
    assert out.shape == (cfg.sequence_length, cfg.num_engineered_features)
