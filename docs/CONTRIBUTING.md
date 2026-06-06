# Contributing

## Setup

```bash
cd mobile && bun install && bun start
```

## PR checks

```bash
bun check
bun run typecheck
bun test
```

CI runs the same.

## Edit map

| Change | Path |
|--------|------|
| Rep counting / phases | `mobile/src/lib/squat/repDetector.ts` |
| Model / features | `biomechanics.ts`, `squatInference.ts`, `constants.ts` |
| Camera | `WorkoutCamera.tsx`, `rawLandmarks.ts` |
| Workout screen | `mobile/src/app/(tabs)/index.tsx` |
| Settings | `AppSettingsContext`, settings screen |
| Copy | `constants/feedbackStrings.ts` |

Algorithms belong in `lib/`. Add unit tests for rep or model changes.

## ML

Train in `squat-posture-ai/` or `ml/`. New models: [MODEL_DEPLOY.md](./MODEL_DEPLOY.md). User-visible changes: [QA_CHECKLIST.md](./QA_CHECKLIST.md) on device.
