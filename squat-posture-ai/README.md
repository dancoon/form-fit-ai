# Squat Posture AI

Training and export for the squat form model. See [../mobile](../mobile) for the on-device app.

## Requirements

| Constraint | Value |
|------------|-------|
| Python | 3.10–3.12 (TensorFlow has no 3.14 wheels) |
| numpy | 1.26.x (`mediapipe` requires `<2`) |
| opencv | 4.11.x (`4.12` requires numpy ≥2) |

Linux/WSL: `libegl1`, `libgles2` (MediaPipe pose).

## Setup

### Linux / WSL

```bash
sudo apt install -y python3.12 python3.12-venv libegl1 libgles2 libglib2.0-0
python3.12 -m venv .venv && source .venv/bin/activate
pip install -U pip -r requirements.txt && pip install -e .
```

### Windows

```powershell
py -3.12 -m venv .venv
.venv\Scripts\activate
python -m pip install -U pip -r requirements.txt
python -m pip install -e .
```

Use `python -m pip` so packages land in the active venv.

Pip hash mismatch: `pip cache purge && pip install --no-cache-dir -r requirements.txt`

## Annotation

Input: `data/raw/videos/`

```bash
source .venv/bin/activate   # WSL/Linux — create venv in Setup if missing
python run_annotation.py extract
python run_annotation.py segment
python -m jupyter lab notebooks/annotate.ipynb
python run_annotation.py export --check
```

Output: `data/annotated/annotated_dataset.npz`

`python run_annotation.py status [-v]` — pipeline progress.

### Pose backends

| OS | `--gpu` | Default |
|----|---------|---------|
| Linux + NVIDIA | yes | tasks, GPU if `nvidia-smi` OK |
| Windows | no (CPU fallback) | tasks, CPU |
| WSL | no (segfault) | solutions, CPU |

```bash
python run_annotation.py extract           # platform default
python run_annotation.py extract --cpu     # force CPU
python run_annotation.py extract --gpu     # Linux only
```

Env: `ANNOTATION_POSE_BACKEND`, `ANNOTATION_POSE_USE_GPU`, `ANNOTATION_POSE_ALLOW_WSL_GPU` (WSL GPU opt-in, unstable).

## Train

```bash
python -m jupyter lab notebooks/train.ipynb
python run_pipeline.py
pytest
```

## Mobile export

[../docs/MODEL_DEPLOY.md](../docs/MODEL_DEPLOY.md) — copy TFLite + scaler to `mobile/src/assets/models/`. Keep `sequence_length = 30` in sync with `mobile/src/lib/squat/constants.ts`.
