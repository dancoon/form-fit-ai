# Architecture

## Layout

| Path | Scope |
|------|-------|
| `mobile/src/lib/` | Squat logic — no React |
| `mobile/src/hooks/` | React lifecycle wiring |
| `mobile/src/components/` | UI, camera, overlay |
| `mobile/src/app/` | Screens — compose hooks only |

`lib/` must not import `app/`, `components/`, `hooks/`, or `context/`.

Alias: `@/*` → `mobile/src/*`

## Squat pipeline

```
Camera (MediaPipe)
  → raw landmarks
  → SquatRepTracker (rep count, phase, window)
  → [rep complete] SquatInferencePipeline (features → TFLite → feedback)
```

### Coordinates

| Module | Space | Use |
|--------|-------|-----|
| `rawLandmarks.ts` | MediaPipe normalized | Rep detection, model input |
| `pose/landmarks.ts` | Screen-mapped | Overlay only |

Do not mix.

## Modules

| File | Role |
|------|------|
| `repDetector.ts` | Rep FSM, window buffer |
| `squatInference.ts` | Inference, depth gate, feedback |
| `biomechanics.ts` | 22-d features |
| `WorkoutCamera.tsx` | Pose frame ingress |
| `useSquatAnalysis.ts` | Model load, pipeline ref |

Full map: [mobile/src/lib/squat/README.md](../mobile/src/lib/squat/README.md)

## Assets

`mobile/src/assets/models/` — `.tflite`, `.task`, `feature_scaler.json`

`SQUAT_SEQUENCE_LENGTH` (45) must match training export.
