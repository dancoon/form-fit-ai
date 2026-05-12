import { useMemo, useState } from "react";

/**
 * useMockMLPipeline
 *
 * This hook simulates the data stream from a Pose Estimation and Biomechanical Analysis model.
 * It provides O(1) memory transfers by using TypedArrays, which can be directly uploaded
 * to WebGL uniform registers without transformation overhead.
 *
 * @returns {Object} { uLandmarks, uSeverity, severity, setSeverity, feedback }
 */
export const useMockMLPipeline = () => {
  // Local state to track the manual severity input (0.0 to 1.0)
  const [severity, setSeverity] = useState<number>(0.0);

  /**
   * uLandmarks: Float32Array (66 elements)
   * Represents 33 landmarks as [x0, y0, x1, y1, ..., x32, y32]
   * Normalized coordinates (0.0 to 1.0) for a static T-pose stick figure.
   */
  const uLandmarks = useMemo(() => {
    const data = new Float32Array(66);

    // --- Mock Pose Definition (Static Stick Figure) ---

    // 0-10: Face/Head (Centered at top)
    for (let i = 0; i <= 10; i++) {
      data[i * 2] = 0.5; // x
      data[i * 2 + 1] = 0.1; // y
    }

    // 11-12: Shoulders
    data[11 * 2] = 0.35;
    data[11 * 2 + 1] = 0.25; // Left Shoulder
    data[12 * 2] = 0.65;
    data[12 * 2 + 1] = 0.25; // Right Shoulder

    // 13-14: Elbows
    data[13 * 2] = 0.25;
    data[13 * 2 + 1] = 0.35; // Left Elbow
    data[14 * 2] = 0.75;
    data[14 * 2 + 1] = 0.35; // Right Elbow

    // 15-16: Wrists
    data[15 * 2] = 0.15;
    data[15 * 2 + 1] = 0.45; // Left Wrist
    data[16 * 2] = 0.85;
    data[16 * 2 + 1] = 0.45; // Right Wrist

    // 17-22: Hands/Fingers (Close to wrists)
    for (let i = 17; i <= 22; i++) {
      data[i * 2] = i % 2 === 0 ? 0.88 : 0.12;
      data[i * 2 + 1] = 0.48;
    }

    // 23-24: Hips
    data[23 * 2] = 0.42;
    data[23 * 2 + 1] = 0.5; // Left Hip
    data[24 * 2] = 0.58;
    data[24 * 2 + 1] = 0.5; // Right Hip

    // 25-26: Knees
    data[25 * 2] = 0.42;
    data[25 * 2 + 1] = 0.7; // Left Knee
    data[26 * 2] = 0.58;
    data[26 * 2 + 1] = 0.7; // Right Knee

    // 27-28: Ankles
    data[27 * 2] = 0.42;
    data[27 * 2 + 1] = 0.9; // Left Ankle
    data[28 * 2] = 0.58;
    data[28 * 2 + 1] = 0.9; // Right Ankle

    // 29-32: Feet
    for (let i = 29; i <= 32; i++) {
      data[i * 2] = i % 2 === 0 ? 0.62 : 0.38;
      data[i * 2 + 1] = 0.95;
    }

    return data;
  }, []);

  /**
   * uSeverity: Float32Array (4 elements)
   * Simulates 4 different error severity metrics.
   * For the mock, we fill all with the user-defined 'severity' value.
   */
  const uSeverity = useMemo(() => {
    const data = new Float32Array(4);
    data.fill(severity);
    return data;
  }, [severity]);

  /**
   * feedback: string
   * Provides real-time vocal guidance based on error severity.
   */
  const feedback = useMemo(() => {
    if (severity === 0) return "";
    if (severity < 0.2) return "Perfect form, keep it up!";
    if (severity < 0.5) return "Watch your balance.";
    if (severity < 0.8) return "Careful, keep your core tight.";
    return "High risk! Stop and reset your position.";
  }, [severity]);

  return {
    uLandmarks,
    uSeverity,
    severity,
    setSeverity,
    feedback,
  };
};
