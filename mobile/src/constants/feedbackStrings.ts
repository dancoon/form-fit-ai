/** User-facing feedback copy (future i18n entry point). */
export const FEEDBACK = {
  greatDepth: "Awesome depth",
  goLower: "Go a bit lower",
  controlDescent: "Control the descent",
  driveUp: "Drive up through your heels",
  chestUp: "Chest up — finish strong",
  standSideways:
    "Side view: stand sideways · full body in frame · 6–8 ft back. Front view: face the camera with feet hip-width.",
  tapToCalibrate: "Tap when ready to calibrate standing pose",
  calibrateSide:
    "Hold still with straight legs to calibrate (side view works best)",
  calibrateFront: "Hold still facing the camera with straight legs",
  calibratedReady: "Calibrated — begin your squat when ready",
  descentDetected: "Descent detected — keep going",
  repComplete: (n: number) => `Rep ${n} complete — squat again when ready`,
  repCountOnly: "Form model unavailable — rep counting only",
  kneeValgus: "Knees caving inward — push knees out",
  insufficientDepth: "Go deeper — aim for parallel",
  forwardLean: "Too much forward lean — chest up",
  goodForm: (pct: number) => `Good form (${pct}% confidence)`,
  formNeedsImprovement: (pct: number) =>
    `Form needs improvement (${pct}% flagged)`,
} as const;
