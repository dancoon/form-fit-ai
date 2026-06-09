# Model deploy

Source: `ml/train.ipynb` or `squat-posture-ai/notebooks/train.ipynb`

## Export

```bash
cd squat-posture-ai
python export_model.py --model BiGRU
```

Deploys **float32** TFLite to `mobile/src/assets/models/squat_model.tflite` (default). Pass `--quantize` to also write an optional `bigru_quantized.tflite`.

- `squat_model.tflite` — float32, loaded by the app
- `feature_scaler.json` — from the training split

## Copy

| Asset | Destination |
|-------|---------------|
| float32 `.tflite` | `mobile/src/assets/models/squat_model.tflite` |
| `feature_scaler.json` | `mobile/src/assets/models/feature_scaler.json` |

## Constants

If sequence length changed in training, update `SQUAT_SEQUENCE_LENGTH` in `mobile/src/lib/squat/constants.ts` and rebuild the native app.

## Verify

```bash
python scripts/inspect_tflite.py mobile/src/assets/models/squat_model.tflite
```

Expected input: `(1, 45, 22)`.

## Device smoke test

Side view, ~10 squats: rep count, depth feedback, no stale cues between reps.

## Pose model

Bundled: `pose_landmarker_lite.task`. Optional: `pose_landmarker_full.task` in `mobile/src/assets/models/`.

Rep/model code uses raw MediaPipe landmarks (`rawLandmarks.ts`). Overlay uses screen-mapped coords only.
