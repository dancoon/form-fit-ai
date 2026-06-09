# Squat module

Pure TS — rep tracking, features, TFLite inference.

```
pose frame → SquatRepTracker ─┬─ live: getLiveFormCue → buildTrackerFeedback → UI/voice
                              └─ rep done: resample(45) → SquatInferencePipeline → buildModelFeedback
```

Live coaching (heuristics, every frame) and rep-level inference (TFLite, on rep complete) are separate loops. `buildTrackerFeedback` merges both for the status line.

| File | Role |
|------|------|
| `repDetector.ts` | Rep FSM, calibration, window |
| `squatInference.ts` | Pipeline, depth gate, model |
| `biomechanics.ts` | Angles, 22-d features |
| `featureScaler.ts` | Z-score from bundled JSON |
| `squatConfig.ts` | Runtime thresholds |
| `constants.ts` | Sequence length (45), dims — sync with training |
| `loadSquatModel.ts` | TFLite asset load |

Tests: `__tests__/`. `bun test` from repo root.
