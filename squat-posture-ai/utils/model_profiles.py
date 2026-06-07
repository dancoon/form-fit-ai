from __future__ import annotations

from dataclasses import dataclass, fields
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from utils.config import Config


@dataclass(frozen=True)
class ModelProfile:
    """Optional per-architecture overrides. None falls back to global Config."""

    hidden_units: int | None = None
    dropout_rate: float | None = None
    learning_rate: float | None = None
    batch_size: int | None = None
    patience: int | None = None
    epochs: int | None = None
    num_transformer_blocks: int | None = None
    num_attention_heads: int | None = None
    transformer_ff_dim: int | None = None
    label_smoothing: float | None = None


@dataclass(frozen=True)
class ResolvedModelProfile:
    """Concrete training + architecture settings for one model."""

    hidden_units: int
    dropout_rate: float
    learning_rate: float
    batch_size: int
    patience: int
    epochs: int
    num_transformer_blocks: int
    num_attention_heads: int
    transformer_ff_dim: int
    label_smoothing: float

    @classmethod
    def resolve(cls, cfg: Config, overrides: ModelProfile | None = None) -> ResolvedModelProfile:
        o = overrides or ModelProfile()
        return cls(
            hidden_units=o.hidden_units if o.hidden_units is not None else cfg.hidden_units,
            dropout_rate=o.dropout_rate if o.dropout_rate is not None else cfg.dropout_rate,
            learning_rate=o.learning_rate if o.learning_rate is not None else cfg.learning_rate,
            batch_size=o.batch_size if o.batch_size is not None else cfg.batch_size,
            patience=o.patience if o.patience is not None else cfg.patience,
            epochs=o.epochs if o.epochs is not None else cfg.epochs,
            num_transformer_blocks=(
                o.num_transformer_blocks
                if o.num_transformer_blocks is not None
                else cfg.num_transformer_blocks
            ),
            num_attention_heads=(
                o.num_attention_heads
                if o.num_attention_heads is not None
                else cfg.num_attention_heads
            ),
            transformer_ff_dim=(
                o.transformer_ff_dim
                if o.transformer_ff_dim is not None
                else cfg.transformer_ff_dim
            ),
            label_smoothing=(
                o.label_smoothing
                if o.label_smoothing is not None
                else cfg.label_smoothing
            ),
        )

    def summary(self) -> str:
        return (
            f"lr={self.learning_rate:g}, dropout={self.dropout_rate:.2f}, "
            f"batch={self.batch_size}, patience={self.patience}, "
            f"hidden={self.hidden_units}"
        )


# Tuned for ~400 annotated reps (+ augmentation). Adjust after new data.
DEFAULT_MODEL_PROFILES: dict[str, ModelProfile] = {
    # RNNs: higher dropout + lower LR to curb overfitting on small data.
    "LSTM": ModelProfile(dropout_rate=0.40, learning_rate=3e-4, patience=15),
    "BiLSTM": ModelProfile(dropout_rate=0.40, learning_rate=3e-4, patience=15),
    # GRU underfit in benchmarks — give more capacity and a higher LR.
    "GRU": ModelProfile(
        hidden_units=96,
        dropout_rate=0.30,
        learning_rate=1e-3,
        batch_size=16,
        patience=18,
    ),
    "BiGRU": ModelProfile(
        hidden_units=80,
        dropout_rate=0.35,
        learning_rate=5e-4,
        batch_size=24,
        patience=15,
    ),
    "CNN-LSTM": ModelProfile(dropout_rate=0.30, learning_rate=5e-4, patience=12),
    # TCN / LightTransformer were top performers on real data.
    "TCN": ModelProfile(dropout_rate=0.25, learning_rate=1e-3, patience=10),
    # Full transformer overfit (high val, lower test) — regularize harder.
    "Transformer": ModelProfile(
        dropout_rate=0.45,
        learning_rate=3e-4,
        patience=10,
        num_transformer_blocks=1,
    ),
    "LightTransformer": ModelProfile(
        hidden_units=32,
        dropout_rate=0.30,
        learning_rate=1e-3,
        patience=10,
    ),
    "CNN-BiGRU-Attn": ModelProfile(dropout_rate=0.35, learning_rate=5e-4, patience=12),
    "Attention-GRU": ModelProfile(dropout_rate=0.35, learning_rate=5e-4, patience=12),
}


def merge_profiles(base: ModelProfile, **overrides) -> ModelProfile:
    """Return a new profile with selective field overrides."""
    data = {f.name: getattr(base, f.name) for f in fields(ModelProfile)}
    for key, value in overrides.items():
        if key in data:
            data[key] = value
    return ModelProfile(**data)
