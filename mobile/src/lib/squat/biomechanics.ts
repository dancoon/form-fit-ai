import { LM } from "@/lib/squat/landmarkIndices";

const EPS = 1e-8;

function getLandmarkCoords(
  frame: Float32Array,
  idx: number,
): [number, number, number] {
  const start = idx * 4;
  return [frame[start], frame[start + 1], frame[start + 2]];
}

function computeAngle(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): number {
  const ba = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const bc = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const dot = ba[0] * bc[0] + ba[1] * bc[1] + ba[2] * bc[2];
  const normBa = Math.hypot(ba[0], ba[1], ba[2]);
  const normBc = Math.hypot(bc[0], bc[1], bc[2]);
  const cos = Math.max(-1, Math.min(1, dot / (normBa * normBc + EPS)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function computeInclination(
  top: [number, number, number],
  bottom: [number, number, number],
): number {
  const diff = [top[0] - bottom[0], top[1] - bottom[1], top[2] - bottom[2]];
  const vertical = [0, -1, 0];
  const dot =
    diff[0] * vertical[0] + diff[1] * vertical[1] + diff[2] * vertical[2];
  const norm = Math.hypot(diff[0], diff[1], diff[2]);
  const cos = Math.max(-1, Math.min(1, dot / (norm + EPS)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function extractJointAngles(frame: Float32Array): Float32Array {
  const lShoulder = getLandmarkCoords(frame, LM.LEFT_SHOULDER);
  const rShoulder = getLandmarkCoords(frame, LM.RIGHT_SHOULDER);
  const lHip = getLandmarkCoords(frame, LM.LEFT_HIP);
  const rHip = getLandmarkCoords(frame, LM.RIGHT_HIP);
  const lKnee = getLandmarkCoords(frame, LM.LEFT_KNEE);
  const rKnee = getLandmarkCoords(frame, LM.RIGHT_KNEE);
  const lAnkle = getLandmarkCoords(frame, LM.LEFT_ANKLE);
  const rAnkle = getLandmarkCoords(frame, LM.RIGHT_ANKLE);

  const midShoulder: [number, number, number] = [
    (lShoulder[0] + rShoulder[0]) / 2,
    (lShoulder[1] + rShoulder[1]) / 2,
    (lShoulder[2] + rShoulder[2]) / 2,
  ];
  const midHip: [number, number, number] = [
    (lHip[0] + rHip[0]) / 2,
    (lHip[1] + rHip[1]) / 2,
    (lHip[2] + rHip[2]) / 2,
  ];

  return new Float32Array([
    computeAngle(lHip, lKnee, lAnkle),
    computeAngle(rHip, rKnee, rAnkle),
    computeAngle(lShoulder, lHip, lKnee),
    computeAngle(rShoulder, rHip, rKnee),
    computeAngle(lKnee, lAnkle, getLandmarkCoords(frame, LM.LEFT_HEEL)),
    computeAngle(rKnee, rAnkle, getLandmarkCoords(frame, LM.RIGHT_HEEL)),
    computeInclination(midShoulder, midHip),
    computeAngle(getLandmarkCoords(frame, LM.NOSE), midShoulder, midHip),
    Math.abs(lShoulder[1] - rShoulder[1]) * 100,
    Math.abs(lHip[1] - rHip[1]) * 100,
  ]);
}

function extractSymmetryFeatures(frame: Float32Array): Float32Array {
  const lKnee = getLandmarkCoords(frame, LM.LEFT_KNEE);
  const rKnee = getLandmarkCoords(frame, LM.RIGHT_KNEE);
  const lHip = getLandmarkCoords(frame, LM.LEFT_HIP);
  const rHip = getLandmarkCoords(frame, LM.RIGHT_HIP);
  const lShoulder = getLandmarkCoords(frame, LM.LEFT_SHOULDER);
  const rShoulder = getLandmarkCoords(frame, LM.RIGHT_SHOULDER);
  const lAnkle = getLandmarkCoords(frame, LM.LEFT_ANKLE);
  const rAnkle = getLandmarkCoords(frame, LM.RIGHT_ANKLE);

  const midHip: [number, number, number] = [
    (lHip[0] + rHip[0]) / 2,
    (lHip[1] + rHip[1]) / 2,
    (lHip[2] + rHip[2]) / 2,
  ];

  const kneeSymmetry = Math.abs(
    Math.hypot(
      lKnee[0] - midHip[0],
      lKnee[1] - midHip[1],
      lKnee[2] - midHip[2],
    ) -
      Math.hypot(
        rKnee[0] - midHip[0],
        rKnee[1] - midHip[1],
        rKnee[2] - midHip[2],
      ),
  );

  return new Float32Array([
    kneeSymmetry,
    Math.abs(lHip[1] - rHip[1]),
    Math.abs(lShoulder[1] - rShoulder[1]),
    Math.abs(lAnkle[0] - rAnkle[0]) - Math.abs(lHip[0] - rHip[0]),
  ]);
}

function leftHipPosition(
  sequence: Float32Array[],
  frameIdx: number,
): [number, number, number] {
  return getLandmarkCoords(sequence[frameIdx], LM.LEFT_HIP);
}

function extractDynamics(
  sequence: Float32Array[],
  frameIdx: number,
): Float32Array {
  const getFrame = (i: number) => leftHipPosition(sequence, i);

  let velocity: [number, number, number] = [0, 0, 0];
  let acceleration: [number, number, number] = [0, 0, 0];

  if (frameIdx === 1) {
    const curr = getFrame(frameIdx);
    const prev = getFrame(frameIdx - 1);
    velocity = [curr[0] - prev[0], curr[1] - prev[1], curr[2] - prev[2]];
  } else if (frameIdx > 1) {
    const curr = getFrame(frameIdx);
    const prev = getFrame(frameIdx - 1);
    const prevPrev = getFrame(frameIdx - 2);
    velocity = [curr[0] - prev[0], curr[1] - prev[1], curr[2] - prev[2]];
    const prevVelocity: [number, number, number] = [
      prev[0] - prevPrev[0],
      prev[1] - prevPrev[1],
      prev[2] - prevPrev[2],
    ];
    acceleration = [
      velocity[0] - prevVelocity[0],
      velocity[1] - prevVelocity[1],
      velocity[2] - prevVelocity[2],
    ];
  }

  const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
  const accelMagnitude = Math.hypot(
    acceleration[0],
    acceleration[1],
    acceleration[2],
  );

  let angularVelocity = 0;
  if (frameIdx > 0) {
    const anglesCurr = extractJointAngles(sequence[frameIdx]);
    const anglesPrev = extractJointAngles(sequence[frameIdx - 1]);
    angularVelocity =
      (Math.abs(anglesCurr[0] - anglesPrev[0]) +
        Math.abs(anglesCurr[1] - anglesPrev[1])) /
      2;
  }

  let smoothness = 0;
  if (frameIdx >= 3) {
    const positions = [0, 1, 2, 3].map((i) => getFrame(frameIdx - i));
    const jerks: number[] = [];
    for (let i = 0; i < positions.length - 3; i++) {
      const jerk = [
        positions[i][0] -
          3 * positions[i + 1][0] +
          3 * positions[i + 2][0] -
          positions[i + 3][0],
        positions[i][1] -
          3 * positions[i + 1][1] +
          3 * positions[i + 2][1] -
          positions[i + 3][1],
        positions[i][2] -
          3 * positions[i + 1][2] +
          3 * positions[i + 2][2] -
          positions[i + 3][2],
      ];
      jerks.push(Math.hypot(jerk[0], jerk[1], jerk[2]));
    }
    if (jerks.length > 0) {
      smoothness = -jerks.reduce((a, b) => a + b, 0) / jerks.length;
    }
  }

  const frame = sequence[frameIdx];
  const keyJoints = [
    LM.LEFT_HIP,
    LM.RIGHT_HIP,
    LM.LEFT_SHOULDER,
    LM.RIGHT_SHOULDER,
    LM.LEFT_KNEE,
    LM.RIGHT_KNEE,
  ];
  let comX = 0;
  let comY = 0;
  let comZ = 0;
  for (const j of keyJoints) {
    const [x, y, z] = getLandmarkCoords(frame, j);
    comX += x;
    comY += y;
    comZ += z;
  }
  comX /= keyJoints.length;
  comY /= keyJoints.length;
  comZ /= keyJoints.length;

  return new Float32Array([
    speed,
    accelMagnitude,
    angularVelocity,
    smoothness,
    velocity[1],
    comY,
    comX,
    comZ,
  ]);
}

/** Full per-frame feature vector (22 values) from a landmark sequence window. */
export function extractSequenceFeatures(
  sequence: Float32Array[],
): Float32Array {
  const numFrames = sequence.length;
  const out = new Float32Array(numFrames * 22);

  for (let i = 0; i < numFrames; i++) {
    const angles = extractJointAngles(sequence[i]);
    const symmetry = extractSymmetryFeatures(sequence[i]);
    const dynamics = extractDynamics(sequence, i);
    const offset = i * 22;
    out.set(angles, offset);
    out.set(symmetry, offset + 10);
    out.set(dynamics, offset + 14);
  }

  return out;
}

/** Torso inclination from vertical (degrees). Larger ≈ more forward lean. */
export function torsoInclinationDeg(frame: Float32Array): number {
  const angles = extractJointAngles(frame);
  return angles[6];
}

/**
 * Knee-inward offset vs ankle (normalized image x).
 * Positive when the knee is medial to the ankle (valgus / cave-in).
 */
export function kneeValgusOffsets(frame: Float32Array): {
  left: number;
  right: number;
} {
  const lKnee = getLandmarkCoords(frame, LM.LEFT_KNEE);
  const rKnee = getLandmarkCoords(frame, LM.RIGHT_KNEE);
  const lAnkle = getLandmarkCoords(frame, LM.LEFT_ANKLE);
  const rAnkle = getLandmarkCoords(frame, LM.RIGHT_ANKLE);
  return {
    left: Math.max(0, lKnee[0] - lAnkle[0]),
    right: Math.max(0, rAnkle[0] - rKnee[0]),
  };
}

export function meanKneeAngle(frame: Float32Array): number {
  const angles = extractJointAngles(frame);
  return (angles[0] + angles[1]) / 2;
}

/** Deepest knee flexion across both legs (best for side/profile view). */
export function minKneeAngle(frame: Float32Array): number {
  const angles = extractJointAngles(frame);
  return Math.min(angles[0], angles[1]);
}

/** Average shoulder Y in normalized image space (larger = lower on screen). */
export function meanShoulderY(frame: Float32Array): number {
  const l = getLandmarkCoords(frame, LM.LEFT_SHOULDER);
  const r = getLandmarkCoords(frame, LM.RIGHT_SHOULDER);
  return (l[1] + r[1]) / 2;
}

/**
 * Thigh inclination vs horizontal (degrees), matching classic squat-analyser scripts:
 * `abs(180 * arctan2(hip.y - knee.y, hip.x - knee.x) / pi)`.
 * Lower values ≈ deeper squat (thigh nearer horizontal).
 */
export function hipKneeSegmentAngle(
  hip: [number, number, number],
  knee: [number, number, number],
): number {
  const dy = hip[1] - knee[1];
  const dx = hip[0] - knee[0];
  return Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
}

/** Bilateral average hip→knee segment angle (used for display). */
export function meanHipKneeSegmentAngle(frame: Float32Array): number {
  const lHip = getLandmarkCoords(frame, LM.LEFT_HIP);
  const rHip = getLandmarkCoords(frame, LM.RIGHT_HIP);
  const lKnee = getLandmarkCoords(frame, LM.LEFT_KNEE);
  const rKnee = getLandmarkCoords(frame, LM.RIGHT_KNEE);
  return (
    (hipKneeSegmentAngle(lHip, lKnee) + hipKneeSegmentAngle(rHip, rKnee)) / 2
  );
}

/**
 * Minimum (deepest) hip→knee angle across both legs.
 * Side view: the visible leg drives rep detection; averaging hides depth.
 */
export function minHipKneeSegmentAngle(frame: Float32Array): number {
  const lHip = getLandmarkCoords(frame, LM.LEFT_HIP);
  const rHip = getLandmarkCoords(frame, LM.RIGHT_HIP);
  const lKnee = getLandmarkCoords(frame, LM.LEFT_KNEE);
  const rKnee = getLandmarkCoords(frame, LM.RIGHT_KNEE);
  return Math.min(
    hipKneeSegmentAngle(lHip, lKnee),
    hipKneeSegmentAngle(rHip, rKnee),
  );
}
