from __future__ import annotations

import os
import time
from typing import Dict, List

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras import Model

from utils.config import Config
class TFLiteConverter:
    """Convert and benchmark TFLite models."""

    def __init__(self, config: Config):
        self.cfg = config
        self.conversion_results = {}

    def convert_model(self, model: Model, model_name: str,
                      quantize: bool = False) -> Dict:
        """Convert Keras model to TFLite with optional quantization."""
        result = {'model_name': model_name, 'success': False}

        try:
            converter = tf.lite.TFLiteConverter.from_keras_model(model)

            if quantize:
                converter.optimizations = [tf.lite.Optimize.DEFAULT]
                converter.target_spec.supported_types = [tf.float16]

            tflite_model = converter.convert()

            # Save
            suffix = '_quantized' if quantize else ''
            filename = f"{model_name.lower().replace(' ', '_')}{suffix}.tflite"
            filepath = os.path.join(self.cfg.tflite_dir, filename)
            with open(filepath, 'wb') as f:
                f.write(tflite_model)

            # Benchmark
            size_mb = len(tflite_model) / (1024 * 1024)

            # Inference test
            interpreter = tf.lite.Interpreter(model_content=tflite_model)
            interpreter.allocate_tensors()

            input_details = interpreter.get_input_details()
            output_details = interpreter.get_output_details()

            # Latency measurement
            test_input = np.random.randn(1, self.cfg.sequence_length,
                                        self.cfg.num_engineered_features).astype(np.float32)
            interpreter.set_tensor(input_details[0]['index'], test_input)

            latencies = []
            for _ in range(100):
                t0 = time.time()
                interpreter.invoke()
                latencies.append((time.time() - t0) * 1000)

            avg_latency = np.mean(latencies[10:])  # skip warmup
            fps = 1000 / avg_latency

            result.update({
                'success': True,
                'size_mb': size_mb,
                'latency_ms': avg_latency,
                'fps': fps,
                'quantized': quantize,
                'filepath': filepath,
            })

        except Exception as e:
            result['error'] = str(e)
            print(f"  [FAIL] {model_name}: {e}")

        return result

    def convert_all(self, trained_models: Dict[str, Model]) -> pd.DataFrame:
        """Convert all trained models to TFLite."""
        print("\nConverting models to TensorFlow Lite...")
        results = []

        for name, model in trained_models.items():
            print(f"  Converting {name}...")

            # Standard conversion
            result = self.convert_model(model, name, quantize=False)
            if result['success']:
                print(f"    Standard: {result['size_mb']:.2f}MB, "
                      f"{result['latency_ms']:.2f}ms, {result['fps']:.0f}FPS")
            results.append(result)

            # Quantized conversion
            result_q = self.convert_model(model, f"{name}_quantized", quantize=True)
            if result_q['success']:
                print(f"    Quantized: {result_q['size_mb']:.2f}MB, "
                      f"{result_q['latency_ms']:.2f}ms, {result_q['fps']:.0f}FPS")
            results.append(result_q)

        self.conversion_results = results

        # Create summary
        df = pd.DataFrame([r for r in results if r['success']])
        if not df.empty:
            display_cols = ['model_name', 'size_mb', 'latency_ms', 'fps', 'quantized']
            print("\nTFLite Conversion Summary:")
            print(df[display_cols].to_string(index=False))

        return df


tflite_df = tflite_converter.convert_all(trainer.trained_models)
