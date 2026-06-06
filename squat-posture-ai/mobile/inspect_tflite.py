"""Inspect TFLite model I/O. Run: python3 scripts/inspect_tflite.py [path]"""

import os
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "src/assets/models/tcn_quantized_quantized.tflite"
print("size_bytes", os.path.getsize(path))

try:
    import tensorflow as tf
except ImportError:
    print("Install tensorflow in a venv: python3 -m venv .venv && .venv/bin/pip install tensorflow")
    raise SystemExit(1)

interp = tf.lite.Interpreter(model_path=path)
interp.allocate_tensors()
for d in interp.get_input_details():
    print("INPUT", d["name"], d["shape"], d["dtype"])
for d in interp.get_output_details():
    print("OUTPUT", d["name"], d["shape"], d["dtype"])
