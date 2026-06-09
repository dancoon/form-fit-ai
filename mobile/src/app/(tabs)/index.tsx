import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { BodyOutlineGuide } from "@/components/BodyOutlineGuide";
import { CameraSetupGuide } from "@/components/CameraSetupGuide";
import { RepSummaryCard } from "@/components/RepSummaryCard";
import {
  WebGLOverlay,
  type WebGLOverlayHandle,
} from "@/components/WebGLOverlay";
import {
  createLandmarksBuffer,
  createRawLandmarksBuffer,
  useWorkoutCameraPermission,
  WorkoutCamera,
} from "@/components/WorkoutCamera";
import { WorkoutCameraPreview } from "@/components/WorkoutCameraPreview";
import { WorkoutStatusPanel } from "@/components/WorkoutStatusPanel";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useWorkoutSession } from "@/context/WorkoutSessionContext";
import { FEEDBACK } from "@/constants/feedbackStrings";
import {
  speakFeedback,
  useSquatAnalysis,
  useVocalFeedback,
  useWorkoutRepEffects,
} from "@/hooks";

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    autostart?: string;
    targetReps?: string;
  }>();
  const { hasPermission, requestPermission } = useWorkoutCameraPermission();
  const landmarksBuffer = useRef(createLandmarksBuffer());
  const rawLandmarksBuffer = useRef(createRawLandmarksBuffer());
  const overlayRef = useRef<WebGLOverlayHandle>(null);
  const [poseTrackingEnabled, setPoseTrackingEnabled] = useState(false);
  const [poseDetected, setPoseDetected] = useState(false);
  const [poseError, setPoseError] = useState<string | null>(null);
  const [showRepSummary, setShowRepSummary] = useState(false);
  const [showCameraGuide, setShowCameraGuide] = useState(false);

  const {
    cameraFacing,
    vocalFeedback,
    hapticFeedback,
    developerMode,
    hasSeenCameraGuide,
    markCameraGuideSeen,
    hasCompletedOnboarding,
    loading: settingsLoading,
    poseModelQuality,
  } = useAppSettings();

  const {
    session,
    startSession,
    finishSession,
    recordRep,
    recordRepCount,
    restSecondsRemaining,
    startRest,
    clearRest,
  } = useWorkoutSession();

  const {
    onPoseFrame,
    onPoseLost,
    requestCalibration,
    overlaySeverity,
    severity,
    feedback,
    result,
    modelReady,
    modelLoading,
    modelError,
    repCountOnly,
    bufferLength,
    repCount,
    phaseLabel,
    calibrated,
    calibrationRequested,
    isSquatting,
    repProgress,
    hipKneeAngle,
    repMinHipKneeAngle,
    activeViewAngle,
    reset,
  } = useSquatAnalysis(poseTrackingEnabled);

  const workoutStatus = useMemo(
    () => ({
      poseTrackingEnabled,
      poseDetected,
      poseError,
      modelLoading,
      modelReady,
      modelError,
      repCountOnly,
      calibrated,
      calibrationRequested,
      isSquatting,
      phaseLabel,
      repCount,
      repProgress,
      bufferLength,
      severity,
      feedback,
      result,
      developerMode,
      hipKneeAngle,
      repMinHipKneeAngle,
      activeViewAngle,
      targetReps: session?.targetReps ?? null,
      onCalibratePress: requestCalibration,
    }),
    [
      poseTrackingEnabled,
      poseDetected,
      poseError,
      modelLoading,
      modelReady,
      modelError,
      repCountOnly,
      calibrated,
      calibrationRequested,
      isSquatting,
      phaseLabel,
      repCount,
      repProgress,
      bufferLength,
      severity,
      feedback,
      result,
      developerMode,
      hipKneeAngle,
      repMinHipKneeAngle,
      activeViewAngle,
      session?.targetReps,
      requestCalibration,
    ],
  );

  useVocalFeedback(feedback, vocalFeedback && poseTrackingEnabled);

  useEffect(() => {
    if (!showCameraGuide || !vocalFeedback) return;
    speakFeedback(FEEDBACK.standSideways);
  }, [showCameraGuide, vocalFeedback]);

  const { resetRepEffectRefs } = useWorkoutRepEffects({
    repCount,
    repMinHipKneeAngle,
    result,
    hapticFeedback,
    targetReps: session?.targetReps,
    restSecondsRemaining,
    recordRepCount,
    recordRep,
    startRest,
    onRepInferenceComplete: () => setShowRepSummary(true),
  });

  useEffect(() => {
    if (settingsLoading) return;
    if (!hasCompletedOnboarding) {
      router.replace("/onboarding" as Href);
    }
  }, [settingsLoading, hasCompletedOnboarding, router]);

  useEffect(() => {
    if (params.autostart === "1" && hasPermission) {
      setPoseTrackingEnabled(true);
      const target =
        params.targetReps && params.targetReps !== ""
          ? Number(params.targetReps)
          : null;
      if (!session) startSession("1", target);
    }
  }, [
    params.autostart,
    params.targetReps,
    hasPermission,
    session,
    startSession,
  ]);

  useEffect(() => {
    if (poseTrackingEnabled && !hasSeenCameraGuide) {
      setShowCameraGuide(true);
    }
  }, [poseTrackingEnabled, hasSeenCameraGuide]);

  const handlePoseDetected = useCallback(
    (active: boolean) => {
      setPoseDetected(active);
      if (!active) onPoseLost();
    },
    [onPoseLost],
  );

  const handleLandmarksUpdated = useCallback(() => {
    overlayRef.current?.requestRender();
  }, []);

  const dismissCameraGuide = async () => {
    setShowCameraGuide(false);
    await markCameraGuideSeen();
  };

  const handleFinishSet = async () => {
    const finished = await finishSession();
    setPoseTrackingEnabled(false);
    reset();
    resetRepEffectRefs();
    router.push(
      `/workout-summary?sessionId=${encodeURIComponent(finished?.id ?? "")}` as Href,
    );
  };

  const stopPoseTracking = () => {
    setPoseDetected(false);
    setPoseError(null);
    reset();
    resetRepEffectRefs();
  };

  if (settingsLoading || !hasCompletedOnboarding) {
    return <View className="flex-1 bg-black" />;
  }

  if (hasPermission === undefined) {
    return <View className="flex-1 bg-black" />;
  }

  if (!hasPermission) {
    return (
      <View className="flex-1 items-center justify-center bg-black p-5">
        <Text className="mb-5 text-center text-lg text-white">
          We need your permission to show the camera
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="rounded-full bg-white px-8 py-3"
        >
          <Text className="font-bold text-black">Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black pb-safe">
      <CameraSetupGuide
        visible={showCameraGuide}
        onDismiss={() => void dismissCameraGuide()}
      />

      <View className="m-[10px] flex-1 overflow-hidden rounded-[24px]">
        {poseTrackingEnabled ? (
          <WorkoutCamera
            landmarksBuffer={landmarksBuffer.current}
            rawLandmarksBuffer={rawLandmarksBuffer.current}
            activeCamera={cameraFacing}
            poseModelQuality={poseModelQuality}
            onPoseDetected={handlePoseDetected}
            onPoseError={setPoseError}
            onPoseFrame={onPoseFrame}
            onLandmarksUpdated={handleLandmarksUpdated}
          />
        ) : (
          <WorkoutCameraPreview />
        )}

        {poseTrackingEnabled ? (
          <>
            <WebGLOverlay
              ref={overlayRef}
              uLandmarks={landmarksBuffer.current}
              uSeverity={overlaySeverity}
              poseActive={poseDetected}
            />
            <BodyOutlineGuide
              visible={poseDetected && !calibrated}
            />
          </>
        ) : null}

        <RepSummaryCard
          result={result}
          visible={showRepSummary}
          onHide={() => setShowRepSummary(false)}
        />

        {restSecondsRemaining !== null ? (
          <View className="absolute inset-0 items-center justify-center bg-black/60">
            <Text className="mb-2 font-bold text-2xl text-white">Rest</Text>
            <Text className="mb-6 font-bold text-5xl text-yellow-400">
              {restSecondsRemaining}s
            </Text>
            <TouchableOpacity
              onPress={clearRest}
              className="rounded-full border border-white/30 px-6 py-3"
            >
              <Text className="font-bold text-white">Skip rest</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {poseTrackingEnabled && poseDetected ? (
          <View
            className="absolute top-16 right-5 rounded-full border border-yellow-400/40 bg-yellow-500/20 px-3 py-1"
            accessibilityLabel={`Phase ${phaseLabel}`}
          >
            <Text className="font-semibold text-xs text-yellow-200">
              {isSquatting
                ? phaseLabel.toUpperCase()
                : calibrated
                  ? "READY"
                  : calibrationRequested
                    ? "CALIBRATING"
                    : "HOLD STILL"}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={() => {
            setPoseTrackingEnabled((on) => {
              if (on) {
                stopPoseTracking();
              } else if (!session) {
                startSession("1", null);
              }
              return !on;
            });
          }}
          className="absolute top-5 left-5 overflow-hidden rounded-2xl border border-white/20 bg-white/10 px-4 py-3"
          accessibilityLabel={
            poseTrackingEnabled ? "Stop pose tracking" : "Start pose tracking"
          }
        >
          <Text className="font-bold text-white text-xs uppercase tracking-wide">
            {poseTrackingEnabled ? "Stop pose" : "Start pose"}
          </Text>
        </TouchableOpacity>

        {poseTrackingEnabled && session?.status === "active" ? (
          <TouchableOpacity
            onPress={() => void handleFinishSet()}
            className="absolute top-5 right-5 overflow-hidden rounded-2xl border border-green-400/30 bg-green-500/20 px-4 py-3"
          >
            <Text className="font-bold text-green-100 text-xs uppercase">
              Finish set
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push("/demo")}
            className="absolute top-5 right-5 overflow-hidden rounded-2xl border border-white/20 bg-white/10 px-5 py-3"
          >
            <Text className="font-bold text-white uppercase tracking-wide">
              Play Demo
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="items-center p-5 pt-safe">
        <WorkoutStatusPanel status={workoutStatus} />
      </View>
    </View>
  );
}
