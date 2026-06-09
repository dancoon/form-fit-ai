"""Train and export a single model to TFLite for mobile deployment."""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import numpy as np
import tensorflow as tf

from inference.tflite_runner import verify_tflite_accuracy
from mobile.tflite_converter import TFLiteConverter
from models.architectures.factory import ModelFactory
from training.trainer import TrainingPipeline
from utils.config import Config
from utils.dataset_loader import prepare_training_splits

MODEL_BUILDERS = {
    "LSTM": "build_lstm",
    "BiLSTM": "build_bilstm",
    "GRU": "build_gru",
    "BiGRU": "build_bigru",
    "CNN-LSTM": "build_cnn_lstm",
    "TCN": "build_tcn",
    "Transformer": "build_transformer",
    "LightTransformer": "build_lightweight_transformer",
    "CNN-BiGRU-Attn": "build_cnn_bigru_attention",
    "Attention-GRU": "build_attention_gru",
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _mobile_models_dir() -> Path:
    return _repo_root() / "mobile" / "src" / "assets" / "models"


def build_model(factory: ModelFactory, model_name: str):
    if model_name not in MODEL_BUILDERS:
        raise ValueError(
            f"Unknown model '{model_name}'. Choose from: {', '.join(MODEL_BUILDERS)}"
        )
    factory._activate(model_name)
    builder = getattr(factory, MODEL_BUILDERS[model_name])
    return builder()


def export_model(
    model_name: str,
    *,
    copy_mobile: bool = True,
    quantize: bool = False,
) -> Path:
    cfg = Config()
    tf.random.set_seed(cfg.random_state)
    np.random.seed(cfg.random_state)

    print(f"Preparing data for {model_name} export...")
    splits, pipeline = prepare_training_splits(cfg)

    scaler_path = pipeline.export_feature_scaler(f"{cfg.results_dir}/feature_scaler.json")
    print(f"Scaler exported -> {scaler_path}")

    factory = ModelFactory(cfg)
    model = build_model(factory, model_name)

    trainer = TrainingPipeline(cfg)
    print(f"\nTraining {model_name}...")
    trainer.train_model(model, model_name, splits)

    keras_path = Path(cfg.model_dir) / "exported" / f"{model_name.lower().replace('-', '_')}.keras"
    keras_path.parent.mkdir(parents=True, exist_ok=True)
    model.save(keras_path)
    print(f"Saved Keras model -> {keras_path}")

    converter = TFLiteConverter(cfg)
    std_result = converter.convert_model(model, model_name, quantize=False)
    if not std_result["success"]:
        raise RuntimeError(std_result.get("error", "TFLite conversion failed"))

    print(
        f"TFLite (float32): {std_result['filepath']} "
        f"({std_result['size_mb']:.2f} MB, {std_result['latency_ms']:.2f} ms)"
    )

    float_path = Path(std_result["filepath"])
    deploy_path = float_path
    if quantize:
        q_result = converter.convert_model(model, model_name, quantize=True)
        if not q_result["success"]:
            raise RuntimeError(q_result.get("error", "Quantized TFLite conversion failed"))
        deploy_path = Path(q_result["filepath"])
        print(
            f"TFLite (quantized): {deploy_path} "
            f"({q_result['size_mb']:.2f} MB, {q_result['latency_ms']:.2f} ms)"
        )

    # Mobile bundles float32 (squat_model.tflite); verify that artifact.
    acc = verify_tflite_accuracy(
        str(float_path),
        splits["X_test"],
        splits["y_test"],
        model_name,
    )
    print(f"TFLite test accuracy (float32): {acc['tflite_accuracy']:.4f}")

    if copy_mobile:
        mobile_dir = _mobile_models_dir()
        mobile_dir.mkdir(parents=True, exist_ok=True)

        stem = model_name.lower().replace("-", "_")
        float_mobile_name = f"{stem}.tflite"
        float_mobile_path = mobile_dir / float_mobile_name

        shutil.copy2(float_path, float_mobile_path)
        shutil.copy2(float_path, mobile_dir / "squat_model.tflite")
        shutil.copy2(scaler_path, mobile_dir / "feature_scaler.json")
        print(f"Copied model -> {float_mobile_path}")
        print(f"Copied model -> {mobile_dir / 'squat_model.tflite'} (float32, used by app)")
        print(f"Copied scaler -> {mobile_dir / 'feature_scaler.json'}")

        if quantize and deploy_path != float_path:
            quant_mobile_path = mobile_dir / f"{stem}_quantized.tflite"
            shutil.copy2(deploy_path, quant_mobile_path)
            print(f"Copied model -> {quant_mobile_path} (optional quantized)")

    return deploy_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and export a squat model to TFLite")
    parser.add_argument(
        "--model",
        default="BiGRU",
        choices=list(MODEL_BUILDERS),
        help="Model architecture to train and export (default: BiGRU)",
    )
    parser.add_argument(
        "--no-copy-mobile",
        action="store_true",
        help="Skip copying assets to mobile/src/assets/models/",
    )
    parser.add_argument(
        "--quantize",
        action="store_true",
        help="Also export a quantized TFLite (mobile still uses float32 squat_model.tflite)",
    )
    args = parser.parse_args()

    export_model(
        args.model,
        copy_mobile=not args.no_copy_mobile,
        quantize=args.quantize,
    )
    print("\nExport complete.")
    if not args.no_copy_mobile:
        print("Update loadSquatModel.ts if the bundled filename changed, then rebuild the app.")


if __name__ == "__main__":
    main()
