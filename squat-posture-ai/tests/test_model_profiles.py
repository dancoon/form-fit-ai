from __future__ import annotations

from utils.config import Config
from utils.model_profiles import DEFAULT_MODEL_PROFILES, ModelProfile, merge_profiles


def test_gru_profile_has_higher_capacity():
    cfg = Config()
    profile = cfg.get_model_profile("GRU")
    assert profile.hidden_units == 96
    assert profile.learning_rate == 1e-3
    assert profile.batch_size == 16


def test_transformer_profile_reduces_blocks():
    cfg = Config()
    profile = cfg.get_model_profile("Transformer")
    assert profile.num_transformer_blocks == 1
    assert profile.dropout_rate == 0.45


def test_custom_override_merges_with_defaults():
    cfg = Config(
        model_profiles={
            **DEFAULT_MODEL_PROFILES,
            "GRU": merge_profiles(DEFAULT_MODEL_PROFILES["GRU"], learning_rate=2e-4),
        }
    )
    profile = cfg.get_model_profile("GRU")
    assert profile.hidden_units == 96
    assert profile.learning_rate == 2e-4


def test_unknown_model_uses_global_defaults():
    cfg = Config()
    profile = cfg.get_model_profile("UnknownModel")
    assert profile.hidden_units == cfg.hidden_units
    assert profile.learning_rate == cfg.learning_rate
