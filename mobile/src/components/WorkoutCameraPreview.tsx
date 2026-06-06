import { StyleSheet, type ViewStyle } from "react-native";
import { Camera, useCameraDevice } from "react-native-vision-camera";

/**
 * Camera preview only — no MediaPipe model, no frame processor.
 */
export function WorkoutCameraPreview() {
  const device = useCameraDevice("front");

  if (device == null) {
    return null;
  }

  return (
    <Camera
      style={StyleSheet.absoluteFill as ViewStyle}
      device={device}
      isActive
      resizeMode="cover"
    />
  );
}
