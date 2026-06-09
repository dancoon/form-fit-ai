# QA checklist

Physical device. Run after model or pipeline changes.

## Reps

- [ ] Side view, 10 deep reps — count and phases correct
- [ ] Shallow reps — depth warning fires
- [ ] Fast / slow tempo — no missed or double counts
- [ ] Leave frame mid-rep — cancel or reset without crash

## Model

- [ ] Deep squats — no false "go deeper"
- [ ] New TFLite — `inspect_tflite.py` reports `(1, 30, 22)`

## Camera / UX

- [ ] Full body in frame, back camera default
- [ ] Calibrate-before-reps
- [ ] Speech/haptics — one cue per rep
- [ ] Low light — pose loss handled

## Session

- [ ] Start workout → tracking active
- [ ] Finish set → summary with rep count

## Release gate

1. `bun test` green
2. Checklist complete on target OS build
