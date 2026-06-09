# Squat module

Pure TS — rep tracking, features, TFLite inference.

```
pose frame → SquatRepTracker ─┬─ live: "Next rep" at descent → buildVocalFeedback (TTS)
                              └─ rep done: resample(30) → SquatInferencePipeline → buildModelFeedback
```

Vocal: calibration prompts, "Next rep" when descent starts, model feedback after each rep. On-screen status via `buildTrackerFeedback`.

| File | Role |
|------|------|
| `repDetector.ts` | Rep FSM, calibration, window |
| `squatInference.ts` | Pipeline, depth gate, model |
| `biomechanics.ts` | Angles, 22-d features |
| `featureScaler.ts` | Z-score from bundled JSON |
| `squatConfig.ts` | Runtime thresholds |
| `constants.ts` | Sequence length (30), dims — sync with training |
| `loadSquatModel.ts` | TFLite asset load |

Tests: `__tests__/`. `bun test` from repo root.
