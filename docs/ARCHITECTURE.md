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

Real-time coaching and rep-level AI inference run on **different timelines**.

```text
Pose Frames
    ↓
SquatRepTracker
    ├── Live loop (every frame, ~30 FPS)
    │       ↓
    │   getLiveFormCue + buildTrackerFeedback
    │       ↓
    │   WorkoutStatusPanel / useVocalFeedback
    │
    └── Rep-completion loop (once per rep)
            ↓
        resample → 45 frames (in repDetector)
            ↓
        SquatInferencePipeline.runOnRepWindow
            ↓
         TFLite
            ↓
    SquatInferenceResult + buildModelFeedback
            ↓
        buildTrackerFeedback (merges tracker + AI result)
            ↓
       UI / Voice
```

### Live loop (no ML)

Runs continuously while the user moves. Heuristic coaching only.

| Source | Examples |
|--------|----------|
| `getLiveFormCue` | "Go a little deeper", "Drive through your heels", "Keep your chest proud" |
| `buildTrackerFeedback` (phase) | "Nice and controlled on the way down", calibration prompts |

```
Camera → useSquatAnalysis → SquatRepTracker.pushFrame
       → getLiveFormCue (optional)
       → buildTrackerFeedback → UI / TTS
```

### Rep-completion loop (TFLite)

Runs only after `SquatRepTracker` detects a complete rep and exposes `repWindowReady`.

```
Completed rep window → extractSequenceFeatures → normalize → TFLite
                    → depth gate → buildModelFeedback → buildTrackerFeedback → UI / TTS
```

`buildTrackerFeedback` priority: live cue → model feedback → calibration / phase / rep-complete copy.

See `useSquatAnalysis.ts` (orchestration), `squatFeedback.ts` (copy merge), `squatInference.ts` (model path).

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
