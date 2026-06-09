from __future__ import annotations

from typing import Dict

import numpy as np
import tensorflow as tf
from tensorflow.keras import Model, layers

from utils.config import Config
from utils.model_profiles import ResolvedModelProfile


def _attention_reduce(t):
    return tf.reduce_sum(t, axis=1)


def _attention_reduce_shape(input_shape):
    return (input_shape[0], input_shape[2])


class ModelFactory:
    """Factory for creating all model architectures with unified interface."""

    def __init__(self, config: Config):
        self.cfg = config
        self.input_shape = (config.sequence_length, config.num_engineered_features)
        self._profile = config.get_model_profile("LSTM")

    @property
    def p(self) -> ResolvedModelProfile:
        return self._profile

    def _activate(self, model_name: str) -> ResolvedModelProfile:
        self._profile = self.cfg.get_model_profile(model_name)
        return self._profile

    def _gru(self, units: int, *, return_sequences: bool = False) -> layers.GRU:
        """GRU with unrolled time steps for TFLite-friendly export (seq len is fixed)."""
        return layers.GRU(
            units,
            return_sequences=return_sequences,
            unroll=True,
        )

    def _add_output_heads(self, x: tf.Tensor,
                          inputs: tf.Tensor) -> Model:
        """Add multi-task output heads to any backbone."""
        # Classification head
        cls_out = layers.Dense(64, activation='relu', name='cls_dense')(x)
        cls_out = layers.Dropout(self.p.dropout_rate)(cls_out)
        cls_out = layers.Dense(1, activation='sigmoid', name='classification')(cls_out)

        # Error detection head (multi-label)
        err_out = layers.Dense(64, activation='relu', name='err_dense')(x)
        err_out = layers.Dropout(self.p.dropout_rate)(err_out)
        err_out = layers.Dense(self.cfg.num_error_types, activation='sigmoid',
                               name='error_detection')(err_out)

        model = Model(inputs=inputs, outputs=[cls_out, err_out])
        return model

    def build_lstm(self) -> Model:
        """Standard LSTM for temporal sequence baseline."""
        inputs = layers.Input(shape=self.input_shape, name='input')
        x = layers.LSTM(self.p.hidden_units, return_sequences=True)(inputs)
        x = layers.Dropout(self.p.dropout_rate)(x)
        x = layers.LSTM(self.p.hidden_units // 2)(x)
        x = layers.BatchNormalization()(x)
        return self._add_output_heads(x, inputs)

    def build_bilstm(self) -> Model:
        """Bidirectional LSTM capturing forward/backward dependencies."""
        inputs = layers.Input(shape=self.input_shape, name='input')
        x = layers.Bidirectional(
            layers.LSTM(self.p.hidden_units, return_sequences=True)
        )(inputs)
        x = layers.Dropout(self.p.dropout_rate)(x)
        x = layers.Bidirectional(
            layers.LSTM(self.p.hidden_units // 2)
        )(x)
        x = layers.BatchNormalization()(x)
        return self._add_output_heads(x, inputs)

    def build_gru(self) -> Model:
        """Lightweight GRU optimized for mobile deployment."""
        inputs = layers.Input(shape=self.input_shape, name='input')
        x = self._gru(self.p.hidden_units, return_sequences=True)(inputs)
        x = layers.Dropout(self.p.dropout_rate)(x)
        x = self._gru(self.p.hidden_units // 2)(x)
        x = layers.BatchNormalization()(x)
        return self._add_output_heads(x, inputs)

    def build_bigru(self) -> Model:
        """Bidirectional GRU with reduced parameter count."""
        inputs = layers.Input(shape=self.input_shape, name='input')
        x = layers.Bidirectional(
            self._gru(self.p.hidden_units, return_sequences=True)
        )(inputs)
        x = layers.Dropout(self.p.dropout_rate)(x)
        x = layers.Bidirectional(
            self._gru(self.p.hidden_units // 2)
        )(x)
        x = layers.BatchNormalization()(x)
        return self._add_output_heads(x, inputs)

    def build_cnn_lstm(self) -> Model:
        """CNN for local feature extraction + LSTM for temporal modeling."""
        inputs = layers.Input(shape=self.input_shape, name='input')

        # CNN block for local temporal patterns
        x = layers.Conv1D(64, 3, padding='same', activation='relu')(inputs)
        x = layers.BatchNormalization()(x)
        x = layers.Conv1D(64, 3, padding='same', activation='relu')(x)
        x = layers.MaxPooling1D(2)(x)
        x = layers.Dropout(self.p.dropout_rate)(x)

        # LSTM for long-range dependencies
        x = layers.LSTM(self.p.hidden_units, return_sequences=False)(x)
        x = layers.BatchNormalization()(x)

        return self._add_output_heads(x, inputs)

    def _tcn_residual_block(self, x: tf.Tensor, filters: int,
                            kernel_size: int, dilation: int) -> tf.Tensor:
        """TCN residual block with dilated causal convolution."""
        residual = x

        out = layers.Conv1D(filters, kernel_size, padding='causal',
                            dilation_rate=dilation, activation='relu')(x)
        out = layers.BatchNormalization()(out)
        out = layers.Dropout(self.p.dropout_rate)(out)

        out = layers.Conv1D(filters, kernel_size, padding='causal',
                            dilation_rate=dilation, activation='relu')(out)
        out = layers.BatchNormalization()(out)
        out = layers.Dropout(self.p.dropout_rate)(out)

        # Match dimensions for residual connection
        if residual.shape[-1] != filters:
            residual = layers.Conv1D(filters, 1, padding='same')(residual)

        return layers.Add()([out, residual])

    def build_tcn(self) -> Model:
        """Temporal Convolutional Network with dilated residual blocks."""
        inputs = layers.Input(shape=self.input_shape, name='input')

        x = inputs
        for dilation in [1, 2, 4, 8]:
            x = self._tcn_residual_block(x, 64, kernel_size=3, dilation=dilation)

        x = layers.GlobalAveragePooling1D()(x)
        x = layers.BatchNormalization()(x)

        return self._add_output_heads(x, inputs)

    def _positional_encoding(self, seq_len: int, d_model: int) -> tf.Tensor:
        """Sinusoidal positional encoding."""
        positions = np.arange(seq_len)[:, np.newaxis]
        dims = np.arange(d_model)[np.newaxis, :]
        angles = positions / np.power(10000, (2 * (dims // 2)) / d_model)
        angles[:, 0::2] = np.sin(angles[:, 0::2])
        angles[:, 1::2] = np.cos(angles[:, 1::2])
        return tf.constant(angles[np.newaxis, :, :], dtype=tf.float32)

    def _transformer_block(self, x: tf.Tensor, num_heads: int,
                           ff_dim: int) -> tf.Tensor:
        """Single transformer encoder block."""
        attn_output = layers.MultiHeadAttention(
            num_heads=num_heads,
            key_dim=x.shape[-1] // num_heads
        )(x, x)
        attn_output = layers.Dropout(self.p.dropout_rate)(attn_output)
        x1 = layers.LayerNormalization()(x + attn_output)

        ff_output = layers.Dense(ff_dim, activation='relu')(x1)
        ff_output = layers.Dense(x1.shape[-1])(ff_output)
        ff_output = layers.Dropout(self.p.dropout_rate)(ff_output)
        x2 = layers.LayerNormalization()(x1 + ff_output)

        return x2

    def build_transformer(self) -> Model:
        """Full Transformer Encoder for pose sequences."""
        inputs = layers.Input(shape=self.input_shape, name='input')

        # Project to model dimension
        x = layers.Dense(self.p.hidden_units)(inputs)

        # Add positional encoding
        pos_enc = self._positional_encoding(self.cfg.sequence_length,
                                           self.p.hidden_units)
        x = x + pos_enc

        # Transformer blocks
        for _ in range(self.p.num_transformer_blocks):
            x = self._transformer_block(x, self.p.num_attention_heads,
                                        self.p.transformer_ff_dim)

        x = layers.GlobalAveragePooling1D()(x)
        x = layers.Dense(64, activation='relu')(x)
        x = layers.Dropout(self.p.dropout_rate)(x)

        return self._add_output_heads(x, inputs)

    def build_lightweight_transformer(self) -> Model:
        """Lightweight Transformer optimized for mobile/TFLite."""
        inputs = layers.Input(shape=self.input_shape, name='input')

        dim = self.p.hidden_units
        ff_dim = max(dim * 2, 32)

        x = layers.Dense(dim)(inputs)
        pos_enc = self._positional_encoding(self.cfg.sequence_length, dim)
        x = x + pos_enc

        attn = layers.MultiHeadAttention(
            num_heads=2, key_dim=max(dim // 2, 8)
        )(x, x)
        attn = layers.Dropout(self.p.dropout_rate)(attn)
        x = layers.LayerNormalization()(x + attn)

        ff = layers.Dense(ff_dim, activation='relu')(x)
        ff = layers.Dense(dim)(ff)
        x = layers.LayerNormalization()(x + ff)

        x = layers.GlobalAveragePooling1D()(x)
        x = layers.Dense(dim, activation='relu')(x)

        return self._add_output_heads(x, inputs)

    def build_cnn_bigru_attention(self) -> Model:
        """CNN + Bidirectional GRU + Attention mechanism."""
        inputs = layers.Input(shape=self.input_shape, name='input')

        # CNN feature extraction
        x = layers.Conv1D(64, 3, padding='same', activation='relu')(inputs)
        x = layers.BatchNormalization()(x)
        x = layers.Conv1D(64, 3, padding='same', activation='relu')(x)
        x = layers.Dropout(self.p.dropout_rate)(x)

        # BiGRU
        x = layers.Bidirectional(
            self._gru(self.p.hidden_units, return_sequences=True)
        )(x)

        # Attention
        attention_weights = layers.Dense(1, activation='tanh')(x)
        attention_weights = layers.Softmax(axis=1)(attention_weights)
        x = layers.Multiply()([x, attention_weights])
        x = layers.Lambda(_attention_reduce, output_shape=_attention_reduce_shape)(x)

        x = layers.BatchNormalization()(x)
        x = layers.Dense(64, activation='relu')(x)
        x = layers.Dropout(self.p.dropout_rate)(x)

        return self._add_output_heads(x, inputs)

    def build_attention_gru(self) -> Model:
        """Attention-based GRU with visualizable attention weights."""
        inputs = layers.Input(shape=self.input_shape, name='input')

        # BiGRU encoder
        x = layers.Bidirectional(
            self._gru(self.p.hidden_units, return_sequences=True)
        )(inputs)
        x = layers.Dropout(self.p.dropout_rate)(x)

        # Attention layer with named output for visualization
        attention_score = layers.Dense(self.p.hidden_units * 2,
                                      activation='tanh', name='attn_tanh')(x)
        attention_score = layers.Dense(1, name='attn_score')(attention_score)
        attention_weights = layers.Softmax(axis=1, name='attention_weights')(attention_score)

        # Context vector
        context = layers.Multiply()([x, attention_weights])
        context = layers.Lambda(_attention_reduce, output_shape=_attention_reduce_shape)(context)

        x = layers.BatchNormalization()(context)
        x = layers.Dense(64, activation='relu')(x)
        x = layers.Dropout(self.p.dropout_rate)(x)

        return self._add_output_heads(x, inputs)

    def get_all_models(self) -> Dict[str, Model]:
        """Build and return all model architectures with per-model profiles."""
        builders = {
            'LSTM': self.build_lstm,
            'BiLSTM': self.build_bilstm,
            'GRU': self.build_gru,
            'BiGRU': self.build_bigru,
            'CNN-LSTM': self.build_cnn_lstm,
            'TCN': self.build_tcn,
            'Transformer': self.build_transformer,
            'LightTransformer': self.build_lightweight_transformer,
            'CNN-BiGRU-Attn': self.build_cnn_bigru_attention,
            'Attention-GRU': self.build_attention_gru,
        }
        models = {}
        for name, builder in builders.items():
            self._activate(name)
            models[name] = builder()
        return models
