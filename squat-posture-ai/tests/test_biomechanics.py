from __future__ import annotations

import numpy as np

from utils.biomechanics import BiomechanicsEngine
from utils.config import Config

def test_feature_dim_matches_config():
    cfg = Config()
    engine = BiomechanicsEngine()
    frame = np.random.rand(cfg.raw_feature_dim).astype(np.float32)
    features = engine.extract_frame_features(frame)
    assert features.shape == (cfg.num_joint_angles + cfg.num_symmetry_features,)
