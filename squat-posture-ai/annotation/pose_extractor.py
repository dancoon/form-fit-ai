"""BlazePose landmark extraction from squat videos."""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import sys
import urllib.request
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from tqdm.auto import tqdm

log = logging.getLogger("squat-annotate")

POSE_MODEL_URLS = {
    0: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    1: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    2: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
}


def is_wsl() -> bool:
    """WSL can run nvidia-smi but MediaPipe GPU Tasks API still segfaults on EGL/DRI3."""
    if os.environ.get("WSL_DISTRO_NAME") or os.environ.get("WSL_INTEROP"):
        return True
    try:
        with open("/proc/version", encoding="utf-8") as f:
            return "microsoft" in f.read().lower()
    except OSError:
        return False


def wsl_gpu_allowed() -> bool:
    """Opt-in for the broken WSL GPU path (usually segfaults)."""
    return os.environ.get("ANNOTATION_POSE_ALLOW_WSL_GPU", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def mediapipe_tasks_gpu_supported() -> bool:
    """MediaPipe Tasks GPU delegate is Linux-native only (not Windows or WSL)."""
    if sys.platform == "win32":
        return False
    if is_wsl() and not wsl_gpu_allowed():
        return False
    return True


def gpu_available() -> bool:
    """True when NVIDIA GPU is usable for MediaPipe Tasks GPU delegate."""
    env = os.environ.get("ANNOTATION_POSE_USE_GPU", "").strip().lower()
    if env in ("0", "false", "no"):
        return False
    if not mediapipe_tasks_gpu_supported():
        return False
    if env in ("1", "true", "yes"):
        return True
    if not shutil.which("nvidia-smi"):
        return False
    try:
        result = subprocess.run(
            ["nvidia-smi"],
            capture_output=True,
            timeout=10,
            check=False,
        )
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def _resolve_backend(*, use_gpu: bool, backend: str | None) -> str:
    """tasks = .task MediaPipe API. solutions = classic API (CPU, WSL-safe)."""
    if backend:
        return backend
    forced = os.environ.get("ANNOTATION_POSE_BACKEND", "").strip().lower()
    if forced in ("tasks", "solutions"):
        return forced
    if is_wsl():
        return "solutions"
    if use_gpu or sys.platform != "linux":
        return "tasks"
    return "solutions"


def download_pose_model(model_complexity: int, cache_dir: Path) -> Path:
    cache_dir.mkdir(parents=True, exist_ok=True)
    model_name = {0: "lite", 1: "full", 2: "heavy"}[model_complexity]
    model_path = cache_dir / f"pose_landmarker_{model_name}.task"
    if not model_path.exists():
        log.info("Downloading pose model (%s)...", model_name)
        urllib.request.urlretrieve(POSE_MODEL_URLS[model_complexity], model_path)
    return model_path


def _landmarks_to_array(pose_landmarks) -> np.ndarray:
    landmarks = np.zeros(132, dtype=np.float32)
    for i, lm in enumerate(pose_landmarks):
        landmarks[i * 4] = lm.x
        landmarks[i * 4 + 1] = lm.y
        landmarks[i * 4 + 2] = lm.z
        landmarks[i * 4 + 3] = getattr(lm, "visibility", 0.0) or 0.0
    return landmarks


class _PoseBackend(ABC):
    @abstractmethod
    def extract_frame(self, frame_bgr: np.ndarray, timestamp_ms: int = 0) -> np.ndarray | None:
        raise NotImplementedError

    @abstractmethod
    def reset(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def close(self) -> None:
        raise NotImplementedError


class _SolutionsBackend(_PoseBackend):
    """Classic mp.solutions.pose — CPU, stable when Tasks API crashes on WSL."""

    def __init__(
        self,
        model_complexity: int,
        min_detection_confidence: float,
        min_tracking_confidence: float,
    ) -> None:
        import mediapipe as mp

        self._model_complexity = model_complexity
        self._min_detection_confidence = min_detection_confidence
        self._min_tracking_confidence = min_tracking_confidence
        self._mp_pose = mp.solutions.pose
        self._pose = self._open_pose()

    def _open_pose(self):
        return self._mp_pose.Pose(
            static_image_mode=False,
            model_complexity=self._model_complexity,
            min_detection_confidence=self._min_detection_confidence,
            min_tracking_confidence=self._min_tracking_confidence,
        )

    def extract_frame(self, frame_bgr: np.ndarray, timestamp_ms: int = 0) -> np.ndarray | None:
        del timestamp_ms
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        results = self._pose.process(rgb)
        if not results.pose_landmarks:
            return None
        return _landmarks_to_array(results.pose_landmarks.landmark)

    def reset(self) -> None:
        self.close()
        self._pose = self._open_pose()

    def close(self) -> None:
        if hasattr(self, "_pose") and self._pose is not None:
            self._pose.close()
            self._pose = None


class _TasksBackend(_PoseBackend):
    """MediaPipe Tasks API — supports GPU delegate when EGL is working."""

    def __init__(
        self,
        model_complexity: int,
        min_detection_confidence: float,
        min_tracking_confidence: float,
        model_cache_dir: Path,
        *,
        use_gpu: bool,
    ) -> None:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_tasks
        from mediapipe.tasks.python import vision

        self._mp = mp
        self._vision = vision
        self._model_path = download_pose_model(model_complexity, model_cache_dir)
        self._min_detection_confidence = min_detection_confidence
        self._min_tracking_confidence = min_tracking_confidence
        self._mp_tasks = mp_tasks
        self._use_gpu = use_gpu
        self._create_landmarker()

    def _create_landmarker(self) -> None:
        delegate = (
            self._mp_tasks.BaseOptions.Delegate.GPU
            if self._use_gpu
            else self._mp_tasks.BaseOptions.Delegate.CPU
        )
        log.info("MediaPipe delegate: %s", "GPU" if self._use_gpu else "CPU")

        base_options = self._mp_tasks.BaseOptions(
            model_asset_path=str(self._model_path),
            delegate=delegate,
        )
        options = self._vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=self._vision.RunningMode.VIDEO,
            min_pose_detection_confidence=self._min_detection_confidence,
            min_tracking_confidence=self._min_tracking_confidence,
        )
        try:
            self.landmarker = self._vision.PoseLandmarker.create_from_options(options)
        except NotImplementedError:
            if self._use_gpu:
                log.warning(
                    "GPU delegate not supported on this platform — falling back to CPU"
                )
                self._use_gpu = False
                self._create_landmarker()
                return
            raise
        except OSError as e:
            if "libGLESv2" in str(e) or "shared object file" in str(e):
                raise OSError(
                    f"{e}\n\n"
                    "Install OpenGL libs: sudo apt install -y libegl1 libgles2\n"
                    "Or CPU fallback: python run_annotation.py extract --cpu"
                ) from e
            raise

    def extract_frame(self, frame_bgr: np.ndarray, timestamp_ms: int = 0) -> np.ndarray | None:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb = np.ascontiguousarray(rgb)
        mp_image = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb)
        results = self.landmarker.detect_for_video(mp_image, int(timestamp_ms))
        if not results.pose_landmarks:
            return None
        return _landmarks_to_array(results.pose_landmarks[0])

    def reset(self) -> None:
        self.close()
        self._create_landmarker()

    def close(self) -> None:
        if hasattr(self, "landmarker"):
            self.landmarker.close()


class PoseExtractor:
    """Extracts BlazePose landmarks from video frames."""

    def __init__(
        self,
        model_complexity: int = 2,
        min_detection_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
        model_cache_dir: Path | str = "./models/pose",
        backend: str | None = None,
        *,
        use_gpu: bool | None = None,
    ) -> None:
        if model_complexity not in POSE_MODEL_URLS:
            raise ValueError("model_complexity must be 0 (lite), 1 (full), or 2 (heavy)")

        if use_gpu is None:
            use_gpu = gpu_available()

        from annotation.log import configure_headless_env

        configure_headless_env(use_gpu=use_gpu)

        self._use_gpu = use_gpu
        self._backend_name = _resolve_backend(use_gpu=use_gpu, backend=backend)

        if self._backend_name == "tasks" and use_gpu and not gpu_available():
            log.warning("GPU requested but nvidia-smi not available — using CPU delegate")

        log.info(
            "Pose: backend=%s delegate=%s model_complexity=%d",
            self._backend_name,
            "GPU" if use_gpu and self._backend_name == "tasks" else "CPU",
            model_complexity,
        )

        if self._backend_name == "solutions":
            self._impl: _PoseBackend = _SolutionsBackend(
                model_complexity, min_detection_confidence, min_tracking_confidence
            )
        else:
            self._impl = _TasksBackend(
                model_complexity,
                min_detection_confidence,
                min_tracking_confidence,
                Path(model_cache_dir),
                use_gpu=use_gpu,
            )

    def extract_frame(self, frame_bgr: np.ndarray, timestamp_ms: int = 0) -> np.ndarray | None:
        return self._impl.extract_frame(frame_bgr, timestamp_ms)

    def extract_video(
        self,
        video_path: str | Path,
        sample_every_n: int = 1,
    ) -> tuple[np.ndarray, dict[str, Any]]:
        self._impl.reset()

        video_path = Path(video_path)
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        metadata: dict[str, Any] = {
            "video_path": str(video_path),
            "fps": fps,
            "total_frames": total_frames,
            "width": width,
            "height": height,
            "duration_sec": total_frames / fps if fps > 0 else 0,
            "sample_every_n": sample_every_n,
            "pose_backend": self._backend_name,
            "pose_delegate": "GPU" if self._use_gpu and self._backend_name == "tasks" else "CPU",
        }

        all_landmarks: list[np.ndarray] = []
        frame_indices: list[int] = []
        failed_frames: list[int] = []

        log.debug("%s — %d frames @ %.1f FPS", video_path.name, total_frames, fps)

        frame_idx = 0
        pbar = tqdm(total=max(1, total_frames // sample_every_n), desc="Pose extraction")

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % sample_every_n == 0:
                timestamp_ms = int(frame_idx / fps * 1000) if fps > 0 else frame_idx * 33
                landmarks = self.extract_frame(frame, timestamp_ms)
                if landmarks is not None:
                    all_landmarks.append(landmarks)
                    frame_indices.append(frame_idx)
                else:
                    failed_frames.append(frame_idx)
                pbar.update(1)

            frame_idx += 1

        pbar.close()
        cap.release()

        metadata["extracted_frames"] = len(all_landmarks)
        metadata["failed_frames"] = len(failed_frames)
        success_rate = len(all_landmarks) / max(1, len(all_landmarks) + len(failed_frames))
        metadata["success_rate"] = success_rate
        metadata["frame_indices"] = frame_indices

        log.debug(
            "%s — %d frames extracted (%.1f%% pose success)",
            video_path.name,
            len(all_landmarks),
            success_rate * 100,
        )

        landmarks_array = np.array(all_landmarks, dtype=np.float32)
        return landmarks_array, metadata

    def close(self) -> None:
        self._impl.close()
