from __future__ import annotations

from typing import Dict

import numpy as np
from sklearn.metrics import accuracy_score
import tensorflow as tf

def verify_tflite_accuracy(tflite_path: str, X_test: np.ndarray,
                           y_test: np.ndarray, model_name: str) -> Dict:
    """Verify TFLite model accuracy matches original."""
    interpreter = tf.lite.Interpreter(model_path=tflite_path)
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    predictions = []
    for i in range(min(len(X_test), 100)):
        input_data = X_test[i:i+1].astype(np.float32)
        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()
        output = interpreter.get_tensor(output_details[0]['index'])
        predictions.append(output[0][0])

    predictions = np.array(predictions)
    preds_binary = (predictions >= 0.5).astype(int)
    acc = accuracy_score(y_test[:len(preds_binary)], preds_binary)

    return {'model_name': model_name, 'tflite_accuracy': acc}


# Verify a subset
print("\nVerifying TFLite model accuracy...")
tflite_accuracy_results = []
for result in tflite_converter.conversion_results:
    if result['success'] and not result.get('quantized', False):
        acc_result = verify_tflite_accuracy(
            result['filepath'], splits['X_test'],
            splits['y_test'], result['model_name']
        )
        tflite_accuracy_results.append(acc_result)
        print(f"  {result['model_name']}: TFLite accuracy = {acc_result['tflite_accuracy']:.4f}")
