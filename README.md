# Form Fit AI

On-device squat rep counting and form feedback. Expo + MediaPipe pose + TFLite classifier.

## Run

```bash
cd mobile && bun install
bun start          # Expo Go
bun run dev        # dev client (camera, pose, model)
```

Workout flows need a physical device.

## Layout

```
mobile/              Expo app
squat-posture-ai/    Python training + annotation
ml/                  notebooks (mirror of squat-posture-ai/notebooks)
docs/
```

Squat domain: `mobile/src/lib/squat/`. `lib/` must not import from `app/`, `components/`, `hooks/`, or `context/`.

## Commands

```bash
bun test
bun run typecheck
bun check
```

## ML

Setup and constraints: [squat-posture-ai/README.md](squat-posture-ai/README.md)

```bash
cd squat-posture-ai
python run_annotation.py extract|segment|export
python run_pipeline.py
```

Model deploy: [docs/MODEL_DEPLOY.md](docs/MODEL_DEPLOY.md)

## Docs

| Doc | Contents |
|-----|----------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | App structure, squat pipeline |
| [MODEL_DEPLOY.md](docs/MODEL_DEPLOY.md) | TFLite + scaler swap |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | PR checks, edit map |
| [QA_CHECKLIST.md](docs/QA_CHECKLIST.md) | Device regression |
