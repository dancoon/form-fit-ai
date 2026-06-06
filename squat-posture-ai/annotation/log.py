"""CLI logging setup for the annotation pipeline."""
from __future__ import annotations

import logging
import os
import sys


def configure_headless_env(*, use_gpu: bool = False) -> None:
    """Env vars before MediaPipe/OpenGL loads."""
    os.environ.setdefault("TF_CPP_MIN_LOGLEVEL", "2")
    os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
    os.environ.setdefault("GLOG_minloglevel", "2")

    if use_gpu:
        # Let EGL use the real GPU (WSL2 needs nvidia drivers + nvidia-smi working).
        os.environ.pop("LIBGL_ALWAYS_SOFTWARE", None)
        os.environ.pop("MESA_GL_VERSION_OVERRIDE", None)
    else:
        os.environ.setdefault("LIBGL_ALWAYS_SOFTWARE", "1")
        os.environ.setdefault("MESA_GL_VERSION_OVERRIDE", "3.3")


def quiet_third_party_logs(*, use_gpu: bool = False) -> None:
    configure_headless_env(use_gpu=use_gpu)
    for name in ("tensorflow", "absl", "mediapipe", "h5py"):
        logging.getLogger(name).setLevel(logging.WARNING)


def setup_logging(*, verbose: bool = False, use_gpu: bool = False) -> logging.Logger:
    quiet_third_party_logs(use_gpu=use_gpu)

    level = logging.DEBUG if verbose else logging.INFO
    root = logging.getLogger("squat-annotate")
    root.setLevel(level)

    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
        )
        root.addHandler(handler)

    return root
