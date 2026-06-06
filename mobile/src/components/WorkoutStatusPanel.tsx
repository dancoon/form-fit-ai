import { memo } from "react";
import { Text, View } from "react-native";
import { SquatPhase } from "@/lib/squat/repDetector";
import type { SquatInferenceResult } from "@/lib/squat/squatTypes";

export interface WorkoutPipelineStatus {
  poseTrackingEnabled: boolean;
  poseDetected: boolean;
  poseError: string | null;
  modelLoading: boolean;
  modelReady: boolean;
  modelError: string | null;
  repCountOnly: boolean;
  calibrated: boolean;
  calibrationRequested: boolean;
  isSquatting: boolean;
  phaseLabel: string;
  repCount: number;
  repProgress: number;
  bufferLength: number;
  severity: number;
  feedback: string;
  result: SquatInferenceResult | null;
  developerMode: boolean;
  hipKneeAngle: number;
  repMinHipKneeAngle: number | null;
  activeViewAngle?: "side" | "front";
  targetReps?: number | null;
  onCalibratePress?: () => void;
}

interface WorkoutStatusPanelProps {
  status: WorkoutPipelineStatus;
}

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  const bg = done ? "bg-green-400" : active ? "bg-yellow-400" : "bg-white/20";
  return <View className={`h-2 w-2 rounded-full ${bg}`} />;
}

function stepHint(status: WorkoutPipelineStatus): string | null {
  if (status.poseError)
    return "Check camera permissions and restart pose tracking";
  if (status.modelError) return "Form model failed — rep counting still works";
  if (status.poseTrackingEnabled && !status.poseDetected)
    return "Move back until head and feet are visible";
  if (status.poseDetected && !status.calibrationRequested)
    return "Tap Calibrate when standing tall with straight legs";
  if (status.calibrationRequested && !status.calibrated)
    return "Hold still — side view works best";
  return null;
}

function WorkoutStatusPanelInner({ status }: WorkoutStatusPanelProps) {
  const {
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
    targetReps,
    onCalibratePress,
  } = status;

  const repPct = Math.round(repProgress * 100);
  const hint = stepHint(status);

  const steps = [
    {
      label: "Camera",
      done: poseTrackingEnabled,
      active: !poseTrackingEnabled,
    },
    {
      label: "Pose",
      done: poseDetected,
      active: poseTrackingEnabled && !poseDetected && !poseError,
    },
    {
      label: "Calibrate",
      done: calibrated,
      active: poseDetected && modelReady && !calibrated && !modelError,
    },
    {
      label: "Squat",
      done: isSquatting,
      active: calibrated && !isSquatting && poseDetected && !modelError,
    },
    {
      label: "Analysis",
      done: result != null,
      active: isSquatting && !result && !modelError && !repCountOnly,
    },
  ];

  let headline = "Tap Start pose to begin";
  if (poseTrackingEnabled) {
    if (poseError) headline = `Pose error: ${poseError}`;
    else if (modelError) headline = `Model error: ${modelError}`;
    else if (modelLoading) headline = "Loading form model…";
    else if (!poseDetected) headline = "Step into frame — full body visible";
    else if (!modelReady) headline = "Waiting for model…";
    else if (!calibrationRequested) headline = "Tap Calibrate when ready";
    else if (!calibrated) headline = "Hold still to calibrate standing pose";
    else if (isSquatting) headline = `${phaseLabel} (${repPct}%)`;
    else if (result) {
      headline = result.isCorrect ? "Form looks good" : "Form issue detected";
    } else if (repCountOnly) {
      headline = `Rep counting only — ${repCount} rep${repCount === 1 ? "" : "s"}`;
    } else {
      headline = `Ready — ${repCount} rep${repCount === 1 ? "" : "s"} logged`;
    }
  }

  return (
    <View
      className="w-full items-center rounded-[20px] border border-white/20 bg-white/10 p-5"
      accessibilityLabel={`Workout status. ${headline}. ${repCount} reps.`}
    >
      <View className="mb-3 flex-row flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {steps.map((step) => (
          <View key={step.label} className="flex-row items-center gap-1">
            <StepDot active={step.active} done={step.done} />
            <Text className="text-[10px] text-white/60">{step.label}</Text>
          </View>
        ))}
      </View>

      <Text
        className="mb-1 text-center font-bold text-base text-white tracking-wider"
        accessibilityRole="header"
      >
        {headline}
      </Text>

      {hint ? (
        <Text className="mb-2 text-center text-white/50 text-xs">{hint}</Text>
      ) : null}

      <Text
        className="mb-2 font-bold text-sm text-white/80 tracking-wider"
        accessibilityLabel={`${repCount} reps. Form risk ${Math.round(severity * 100)} percent`}
      >
        REPS: {repCount}
        {targetReps ? ` / ${targetReps}` : ""} · FORM RISK:{" "}
        {(severity * 100).toFixed(0)}%
      </Text>

      {!calibrated && poseDetected && modelReady && onCalibratePress ? (
        <Text
          onPress={onCalibratePress}
          className="mb-2 font-bold text-sm text-yellow-400 underline"
          accessibilityRole="button"
          accessibilityLabel="Calibrate standing pose"
        >
          Calibrate now
        </Text>
      ) : null}

      <View className="mb-2 h-[36px] justify-center px-2">
        {feedback ? (
          <Text className="text-center font-semibold text-sm text-yellow-400">
            {feedback}
          </Text>
        ) : (
          <Text className="text-center text-sm text-white/40">
            Rep detection adapts to your squat speed automatically
          </Text>
        )}
      </View>

      {poseTrackingEnabled &&
      modelReady &&
      (calibrated || calibrationRequested) ? (
        <View className="mb-3 w-full">
          <View className="mb-1 flex-row justify-between">
            <Text className="text-[11px] text-white/50">
              {isSquatting ? "Current rep progress" : "Phase"}
            </Text>
            <Text className="text-[11px] text-white/50">
              {isSquatting ? `${repPct}% · ${bufferLength} frames` : phaseLabel}
            </Text>
          </View>
          <View className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <View
              className={`h-full rounded-full ${isSquatting ? "bg-yellow-400" : "bg-green-400/60"}`}
              style={{
                width: `${isSquatting ? repPct : calibrated ? 100 : 0}%`,
              }}
            />
          </View>
        </View>
      ) : null}

      <View className="mb-2 h-2 w-[224px] overflow-hidden rounded-full bg-white/10">
        <View
          className="h-full rounded-full bg-white"
          style={{ width: `${Math.min(100, severity * 100)}%` }}
        />
      </View>

      {developerMode ? (
        <View className="mb-2 w-full rounded-xl bg-black/40 px-3 py-2">
          <Text className="text-[10px] text-white/60">
            Dev · View: {activeViewAngle ?? "—"} · Knee:{" "}
            {hipKneeAngle.toFixed(1)}° · Min:{" "}
            {repMinHipKneeAngle?.toFixed(1) ?? "—"}° · Frames: {bufferLength}
          </Text>
          <Text className="mt-1 text-[9px] text-white/40">
            Knee ~170° standing → ~90° deep (lower = deeper)
          </Text>
        </View>
      ) : null}

      {result ? (
        <View className="mt-1 w-full rounded-xl bg-black/30 px-3 py-2">
          <Text className="text-[11px] text-white/70">
            Rep {result.repNumber} · Knee:{" "}
            {(result.errors.knee_valgus * 100).toFixed(0)}% · Depth:{" "}
            {(result.errors.insufficient_depth * 100).toFixed(0)}% · Lean:{" "}
            {(result.errors.forward_lean * 100).toFixed(0)}%
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const WorkoutStatusPanel = memo(WorkoutStatusPanelInner);

export { SquatPhase };
