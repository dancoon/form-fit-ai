import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import {
  Delegate,
  MediapipeCamera,
  type PoseDetectionResultBundle,
  RunningMode,
  usePoseDetection,
  type ViewCoordinator,
} from "react-native-mediapipe-posedetection";
import { useCameraPermission } from "react-native-vision-camera";
import {
  clearLandmarksBuffer,
  createLandmarksBuffer,
  type PosePoint,
  writeViewLandmarksToBuffer,
} from "@/lib/pose/landmarks";
import { devLog, logError } from "@/lib/logging";
import { writeRawLandmarksToBuffer } from "@/lib/squat/rawLandmarks";
import type { CameraFacing, PoseModelQuality } from "@/lib/squat/squatConfig";
import { getPoseModelAsset } from "@/lib/squat/squatConfig";

interface WorkoutCameraProps {
  landmarksBuffer: Float32Array;
  rawLandmarksBuffer: Float32Array;
  activeCamera?: CameraFacing;
  poseModelQuality?: PoseModelQuality;
  onPoseDetected?: (hasPose: boolean) => void;
  onPoseError?: (message: string) => void;
  onPoseFrame?: (rawLandmarks: Float32Array) => void;
  /** Fired after the view-mapped landmark buffer is written (or cleared). */
  onLandmarksUpdated?: () => void;
}

export function WorkoutCamera({
  landmarksBuffer,
  rawLandmarksBuffer,
  activeCamera = "back",
  poseModelQuality = "lite",
  onPoseDetected,
  onPoseError,
  onPoseFrame,
  onLandmarksUpdated,
}: WorkoutCameraProps) {
  const viewDimsRef = useRef({ width: 1, height: 1 });
  const poseActiveRef = useRef(false);
  const [delegate, setDelegate] = useState<Delegate>(Delegate.GPU);
  const [delegateNote, setDelegateNote] = useState<string | null>(null);

  const notifyPoseDetected = useCallback(
    (active: boolean) => {
      if (poseActiveRef.current === active) return;
      poseActiveRef.current = active;
      onPoseDetected?.(active);
    },
    [onPoseDetected],
  );

  const handleResults = useCallback(
    (bundle: PoseDetectionResultBundle, vc: ViewCoordinator) => {
      const t0 = __DEV__ ? performance.now() : 0;
      const pose = bundle.results[0]?.landmarks[0];
      const { width: viewWidth, height: viewHeight } = viewDimsRef.current;

      if (!pose?.length || viewWidth <= 1 || viewHeight <= 1) {
        clearLandmarksBuffer(landmarksBuffer);
        notifyPoseDetected(false);
        onLandmarksUpdated?.();
        return;
      }

      const frame = vc.getFrameDims(bundle);
      writeViewLandmarksToBuffer(
        pose as PosePoint[],
        frame,
        vc,
        viewWidth,
        viewHeight,
        landmarksBuffer,
      );
      onPoseFrame?.(writeRawLandmarksToBuffer(pose, rawLandmarksBuffer));
      notifyPoseDetected(true);
      onLandmarksUpdated?.();

      if (__DEV__) {
        const ms = performance.now() - t0;
        if (ms > 25) {
          devLog(
            `[pose] frame handler ${ms.toFixed(1)}ms — MediaPipe bound; overlay tweaks won't help`,
          );
        }
      }
    },
    [
      landmarksBuffer,
      rawLandmarksBuffer,
      notifyPoseDetected,
      onPoseFrame,
      onLandmarksUpdated,
    ],
  );

  const poseDetection = usePoseDetection(
    {
      onResults: handleResults,
      onError: (error) => {
        logError("pose", error.message);
        if (delegate === Delegate.GPU) {
          setDelegate(Delegate.CPU);
          setDelegateNote("Using CPU pose detection (GPU unavailable)");
        }
        onPoseError?.(error.message);
      },
    },
    RunningMode.LIVE_STREAM,
    getPoseModelAsset(poseModelQuality),
    {
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      delegate,
      mirrorMode: "mirror-front-only",
    },
  );

  useLayoutEffect(() => {
    viewDimsRef.current = poseDetection.cameraViewDimensions;
  }, [poseDetection.cameraViewDimensions]);

  useEffect(() => {
    return () => {
      notifyPoseDetected(false);
    };
  }, [notifyPoseDetected]);

  return (
    <>
      <MediapipeCamera
        style={StyleSheet.absoluteFill as ViewStyle}
        solution={poseDetection}
        activeCamera={activeCamera}
      />
      {delegateNote ? (
        <View style={styles.delegateNote}>
          <Text style={styles.delegateText}>{delegateNote}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  delegateNote: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 6,
    borderRadius: 8,
  },
  delegateText: {
    color: "#fff",
    fontSize: 10,
    textAlign: "center",
  },
});

export function useWorkoutCameraPermission() {
  const { hasPermission, requestPermission } = useCameraPermission();
  return { hasPermission, requestPermission };
}

export { createLandmarksBuffer };
export { createRawLandmarksBuffer } from "@/lib/squat/rawLandmarks";
