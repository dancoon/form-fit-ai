# Model deploy

Source: `ml/train.ipynb` or `squat-posture-ai/notebooks/train.ipynb`

## Export

- Quantized `.tflite` (notebook export cells)
- `feature_scaler.json` (data-split step)

## Copy

| Asset | Destination |
|-------|---------------|
| `*.tflite` | `mobile/src/assets/models/tcn_quantized_quantized.tflite` |
| `feature_scaler.json` | `mobile/src/assets/models/feature_scaler.json` |

## Constants

If sequence length changed in training, update `SQUAT_SEQUENCE_LENGTH` in `mobile/src/lib/squat/constants.ts` and rebuild the native app.

## Verify

```bash
python scripts/inspect_tflite.py mobile/src/assets/models/tcn_quantized_quantized.tflite
```

Expected input: `(1, 45, 22)`.

## Device smoke test

Side view, ~10 squats: rep count, depth feedback, no stale cues between reps.

## Pose model

Bundled: `pose_landmarker_lite.task`. Optional: `pose_landmarker_full.task` in `mobile/src/assets/models/`.

Rep/model code uses raw MediaPipe landmarks (`rawLandmarks.ts`). Overlay uses screen-mapped coords only.
