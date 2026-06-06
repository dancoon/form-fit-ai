# Agent guide

Expo: `mobile/`. Squat domain: `mobile/src/lib/squat/`.

- `lib/` must not import `app/`, `components/`, `hooks/`, or `context/`.
- Rep/model: raw MediaPipe landmarks. Overlay: view-mapped coords only.
- `bun test` after squat domain edits.
- Minimal diff.

Refs: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [mobile/src/lib/squat/README.md](mobile/src/lib/squat/README.md), [docs/MODEL_DEPLOY.md](docs/MODEL_DEPLOY.md)
