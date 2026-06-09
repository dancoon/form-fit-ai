from __future__ import annotations

from typing import Dict

import numpy as np
from sklearn.metrics import accuracy_score
import tensorflow as tf

def _classification_output_index(output_details: list) -> int:
    """Pick the sigmoid classification head (shape …, 1), not error_detection (…, 3)."""
    for i, detail in enumerate(output_details):
        shape = detail.get("shape")
        if shape is not None and int(shape[-1]) == 1:
            return i
    return 0


def verify_tflite_accuracy(tflite_path: str, X_test: np.ndarray,
                           y_test: np.ndarray, model_name: str) -> Dict:
    """Verify TFLite model accuracy matches original."""
    interpreter = tf.lite.Interpreter(model_path=tflite_path)
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    cls_idx = _classification_output_index(output_details)

    predictions = []
    n = min(len(X_test), len(y_test))
    for i in range(n):
        input_data = X_test[i:i+1].astype(np.float32)
        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()
        output = interpreter.get_tensor(output_details[cls_idx]['index'])
        predictions.append(float(output.reshape(-1)[0]))

    predictions = np.array(predictions)
    preds_binary = (predictions >= 0.5).astype(int)
    acc = accuracy_score(y_test[:len(preds_binary)], preds_binary)

    return {'model_name': model_name, 'tflite_accuracy': acc}
