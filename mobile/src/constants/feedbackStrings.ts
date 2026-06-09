/** User-facing feedback copy (future i18n entry point). */
export const FEEDBACK = {
  greatDepth: "Perfect depth!",
  goLower: "Just a little deeper",
  controlDescent: "Nice and controlled on the way down",
  driveUp: "Drive through your heels",
  chestUp: "Keep your chest proud",

  standSideways:
    "Stand sideways with your full body in view. For a front view, face the camera with your feet hip-width apart.",

  holdStillToCalibrate:
    "Stand tall with straight legs — we'll calibrate automatically",

  calibrateSide:
    "Stand tall and hold still for a moment while we calibrate.",

  calibrateFront:
    "Face the camera, stand tall, and hold still while we calibrate.",

  calibratedReady: "All set! Start squatting when you're ready.",

  descentDetected: "Good start — keep going",

  repComplete: (n: number) =>
    `Great rep! That's ${n}${n === 1 ? "" : ""}. Keep it up!`,

  repCountOnly:
    "We're counting reps, but form feedback is temporarily unavailable.",

  kneeValgus: "Push your knees out slightly",
  insufficientDepth: "Almost there — go a bit deeper",
  forwardLean: "Stay tall and keep your chest up",

  goodForm: (pct: number) =>
    `Excellent form! (${pct}% confidence)`,

  formNeedsImprovement: (pct: number) =>
    `Good effort. Let's clean up a few things (${pct}% flagged).`,
} as const;