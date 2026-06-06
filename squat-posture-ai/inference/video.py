from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np

from inference.realtime import RealTimeInferencePipeline
class VideoProcessor:
    """Process uploaded videos for squat analysis.

    In Colab, use file upload or Google Drive.
    Integrates MediaPipe BlazePose for pose extraction.
    """

    def __init__(self, inference_pipeline: RealTimeInferencePipeline):
        self.pipeline = inference_pipeline
        self._mp_pose = None

    def _init_mediapipe(self):
        """Lazy initialization of MediaPipe."""
        if self._mp_pose is None:
            import mediapipe as mp
            self._mp_pose = mp.solutions.pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
        return self._mp_pose

    def extract_landmarks_from_frame(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """Extract BlazePose landmarks from a single BGR frame."""
        import mediapipe as mp
        pose = self._init_mediapipe()

        rgb_frame = frame[:, :, ::-1]  # BGR to RGB
        results = pose.process(rgb_frame)

        if results.pose_landmarks is None:
            return None

        landmarks = np.zeros(132, dtype=np.float32)  # 33 * 4
        for i, lm in enumerate(results.pose_landmarks.landmark):
            landmarks[i*4] = lm.x
            landmarks[i*4+1] = lm.y
            landmarks[i*4+2] = lm.z
            landmarks[i*4+3] = lm.visibility

        return landmarks

    def process_video(self, video_path: str,
                      output_path: Optional[str] = None) -> List[Dict]:
        """Process an entire video file for squat analysis."""
        import cv2

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        writer = None
        if output_path:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        self.pipeline.reset()
        all_results = []

        print(f"Processing video: {total_frames} frames at {fps:.0f} FPS")

        frame_idx = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            landmarks = self.extract_landmarks_from_frame(frame)

            if landmarks is not None:
                result = self.pipeline.process_frame(landmarks)
                if result:
                    all_results.append(result)

                    # Annotate frame
                    if writer:
                        frame = self._annotate_frame(frame, result)

            if writer:
                writer.write(frame)

            frame_idx += 1

        cap.release()
        if writer:
            writer.release()

        print(f"Processed {frame_idx} frames, {len(all_results)} predictions")
        return all_results

    def _annotate_frame(self, frame: np.ndarray, result: Dict) -> np.ndarray:
        """Add visual annotations to a video frame."""
        import cv2

        h, w = frame.shape[:2]

        # Background panel
        overlay = frame.copy()
        cv2.rectangle(overlay, (10, 10), (350, 150), (0, 0, 0), -1)
        frame = cv2.addWeighted(overlay, 0.6, frame, 0.4, 0)

        # Status color
        color = (0, 255, 0) if result['is_correct'] else (0, 0, 255)
        status = "CORRECT" if result['is_correct'] else "INCORRECT"

        cv2.putText(frame, f"Form: {status}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        cv2.putText(frame, f"Confidence: {result['confidence']:.0%}", (20, 70),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.putText(frame, f"FPS: {result['fps']:.0f}", (20, 95),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        # Error details
        y_offset = 120
        for error_name, prob in result['errors'].items():
            err_color = (0, 0, 255) if prob > 0.5 else (0, 255, 0)
            cv2.putText(frame, f"{error_name}: {prob:.0%}", (20, y_offset),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, err_color, 1)
            y_offset += 20

        return frame


print("Usage: video_processor.process_video('path/to/squat_video.mp4')")
