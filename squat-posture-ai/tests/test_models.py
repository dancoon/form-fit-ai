from __future__ import annotations

from utils.config import Config
from models.architectures.factory import ModelFactory

def test_tcn_builds():
    cfg = Config()
    factory = ModelFactory(cfg)
    model = factory.build_tcn()
    assert model is not None
    assert model.count_params() > 0
