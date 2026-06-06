from __future__ import annotations

from collections import deque
from typing import Any, Dict, List, Optional

import numpy as np

from utils.biomechanics import BiomechanicsEngine
from utils.config import Config
from utils.data_pipeline import DataPipeline
from utils.temporal import TemporalProcessor
class RealTimeInferencePipeline:
    """Real-time inference for squat analysis."""

    def __init__(self, model: Model, config: Config,
                 scaler: StandardScaler,
                 biomech_engine: BiomechanicsEngine):
        self.model = model
        self.cfg = config
        self.scaler = scaler
        self.biomech = biomech_engine
        self.frame_buffer = []
        self.rep_count = 0
        self.fps_history = []
        self.prediction_history = []

    def reset(self):
        """Reset state for new session."""
        self.frame_buffer = []
        self.rep_count = 0
        self.fps_history = []
        self.prediction_history = []

    def process_frame(self, raw_landmarks: np.ndarray) -> Optional[Dict]:
        """Process a single frame of pose landmarks.

        Args:
            raw_landmarks: Flat array of 33*4=132 values from BlazePose

        Returns:
            Prediction dict or None if buffer not full.
        """
        t_start = time.time()

        self.frame_buffer.append(raw_landmarks)

        # Keep buffer at sequence_length
        if len(self.frame_buffer) > self.cfg.sequence_length:
            self.frame_buffer.pop(0)

        if len(self.frame_buffer) < self.cfg.sequence_length:
            return None

        # Extract features from buffer
        sequence = np.array(self.frame_buffer, dtype=np.float32)
        features = self.biomech.extract_sequence_features(sequence)

        # Normalize
        features_flat = features.reshape(-1, features.shape[-1])
        features_norm = self.scaler.transform(features_flat)
        features_norm = features_norm.reshape(1, self.cfg.sequence_length, -1)

        # Predict
        predictions = self.model.predict(features_norm, verbose=0)
        cls_prob = float(predictions[0][0][0])
        err_probs = predictions[1][0]

        # FPS calculation
        frame_time = time.time() - t_start
        fps = 1.0 / frame_time if frame_time > 0 else 0
        self.fps_history.append(fps)

        # Rep detection
        angles = self.biomech.extract_joint_angles(raw_landmarks)
        knee_angle = (angles[0] + angles[1]) / 2

        result = {
            'is_correct': cls_prob < 0.5,
            'confidence': 1 - cls_prob if cls_prob < 0.5 else cls_prob,
            'errors': {
                'knee_valgus': float(err_probs[0]),
                'insufficient_depth': float(err_probs[1]),
                'forward_lean': float(err_probs[2]),
            },
            'knee_angle': float(knee_angle),
            'fps': fps,
            'avg_fps': np.mean(self.fps_history[-30:]),
        }

        self.prediction_history.append(result)
        return result

    def get_feedback_text(self, result: Dict) -> str:
        """Generate human-readable feedback from prediction."""
        if result['is_correct']:
            return f"Good form! (confidence: {result['confidence']:.0%})"

        errors = []
        if result['errors']['knee_valgus'] > 0.5:
            errors.append("Knees caving inward - push knees out")
        if result['errors']['insufficient_depth'] > 0.5:
            errors.append("Go deeper - aim for parallel")
        if result['errors']['forward_lean'] > 0.5:
            errors.append("Too much forward lean - chest up")

        return f"Form issues detected: {'; '.join(errors)}" if errors else "Form needs improvement"


# Initialize pipeline with best model
best_model_name = results_df.loc[
    results_df['accuracy'].apply(lambda x: float(x) if isinstance(x, str) else x).idxmax(),
    'model_name'
]
print(f"Best model for real-time: {best_model_name}")

if best_model_name in trainer.trained_models:
    rt_pipeline = RealTimeInferencePipeline(
        model=trainer.trained_models[best_model_name],
        config=cfg,
        scaler=pipeline.scaler,
        biomech_engine=biomech
    )
else:
    # Fallback to first available DL model
    fallback_name = list(trainer.trained_models.keys())[0]
    rt_pipeline = RealTimeInferencePipeline(
        model=trainer.trained_models[fallback_name],
        config=cfg,
        scaler=pipeline.scaler,
        biomech_engine=biomech
    )
    print(f"Using fallback model: {fallback_name}")
