/**
 * React adapter for {@link SquatInferencePipeline}: model load, pose frames, inference scheduling.
 * Domain rules live in src/lib/squat — keep this hook orchestration-only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { TfliteModel } from "react-native-fast-tflite";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useSquatModel } from "@/hooks/useSquatModel";
import { logError } from "@/lib/logging";
import {
  buildTrackerFeedback,
  buildVocalFeedback,
  getSquatRuntimeConfig,
  hasTrackerUiChanged,
  phaseLabel,
  predictionToSeverity,
  predictionToUiSeverity,
  resolveViewAngle,
  SquatInferencePipeline,
  SquatPhase,
  type RepTrackerSnapshot,
  type ResolvedViewAngle,
  type SquatInferenceResult,
  ViewAngleVoter,
} from "@/lib/squat";

export function useSquatAnalysis(enabled: boolean) {
  const { cameraAnglePreset, sensitivity, formFeedbackSource, repCountOnlyMode } =
    useAppSettings();

  const viewVoterRef = useRef(new ViewAngleVoter());
  const [detectedView, setDetectedView] = useState<ResolvedViewAngle>("side");

  const activeViewAngle = useMemo(
    () => resolveViewAngle(cameraAnglePreset, detectedView),
    [cameraAnglePreset, detectedView],
  );

  const runtimeConfig = useMemo(
    () =>
      getSquatRuntimeConfig({
        anglePreset: activeViewAngle,
        sensitivity,
        formFeedbackSource,
      }),
    [activeViewAngle, sensitivity, formFeedbackSource],
  );

  const skipFormModel =
    repCountOnlyMode || formFeedbackSource === "biomech";

  const pipelineRef = useRef(new SquatInferencePipeline({ runtimeConfig }));
  const trackerLatestRef = useRef<RepTrackerSnapshot | null>(null);
  const inferenceBusyRef = useRef(false);
  const pendingRepsRef = useRef<
    Array<{ window: Float32Array[]; snapshot: RepTrackerSnapshot }>
  >([]);
  const wasSquattingRef = useRef(false);

  const {
    loadState,
    modelRef,
    modelReady,
    modelLoading,
    modelError,
    repCountOnly,
    degradeToRepCountOnly,
  } = useSquatModel(enabled, skipFormModel);

  const modelLoadStatus = loadState.status;

  const [result, setResult] = useState<SquatInferenceResult | null>(null);
  const [tracker, setTracker] = useState<RepTrackerSnapshot | null>(null);
  const publishTracker = useCallback((snapshot: RepTrackerSnapshot) => {
    trackerLatestRef.current = snapshot;
    setTracker((prev) =>
      hasTrackerUiChanged(prev, snapshot) ? snapshot : prev,
    );
  }, []);

  useEffect(() => {
    pipelineRef.current.setRuntimeConfig(runtimeConfig);
  }, [runtimeConfig]);

  const prevViewRef = useRef(activeViewAngle);
  useEffect(() => {
    if (prevViewRef.current === activeViewAngle) return;
    prevViewRef.current = activeViewAngle;
    pipelineRef.current.requestCalibration();
    viewVoterRef.current.reset();
    trackerLatestRef.current = null;
    setResult(null);
    setTracker(null);
    wasSquattingRef.current = false;
  }, [activeViewAngle]);

  useEffect(() => {
    if (!enabled) {
      pipelineRef.current.reset();
      viewVoterRef.current.reset();
      trackerLatestRef.current = null;
      pendingRepsRef.current = [];
      setResult(null);
      setTracker(null);
      wasSquattingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === "background" && enabled) {
        pipelineRef.current.reset();
        trackerLatestRef.current = null;
        setResult(null);
        setTracker(null);
        wasSquattingRef.current = false;
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [enabled]);

  const runInference = useCallback(
    async (
      model: TfliteModel,
      repWindow: Float32Array[],
      snapshot: RepTrackerSnapshot,
    ) => {
      inferenceBusyRef.current = true;
      try {
        const next = await pipelineRef.current.runOnRepWindow(
          model,
          repWindow,
          snapshot,
        );
        if (next) setResult(next);
      } catch (error) {
        logError("squat", error);
        degradeToRepCountOnly();
      } finally {
        inferenceBusyRef.current = false;
        const m = modelRef.current;
        if (!m) {
          pendingRepsRef.current = [];
          return;
        }
        const next = pendingRepsRef.current.shift();
        if (next) {
          void runInference(m, next.window, next.snapshot);
        }
      }
    },
    [degradeToRepCountOnly, modelRef],
  );

  const requestCalibration = useCallback(() => {
    pipelineRef.current.requestCalibration();
    setResult(null);
  }, []);

  const onPoseLost = useCallback(() => {
    pipelineRef.current.notifyPoseLost();
    const snap = pipelineRef.current.snapshot;
    if (snap) publishTracker(snap);
  }, [publishTracker]);

  const onPoseFrame = useCallback(
    (rawLandmarks: Float32Array) => {
      if (!enabled) return;

      if (cameraAnglePreset === "auto") {
        const voted = viewVoterRef.current.vote(rawLandmarks);
        if (voted) setDetectedView(voted);
      }

      // Track reps + biomech feedback even when TFLite failed or is unavailable.
      if (modelLoadStatus === "idle") return;

      const snapshot = pipelineRef.current.pushFrame(rawLandmarks);
      publishTracker(snapshot);

      if (snapshot.isSquatting && !wasSquattingRef.current) {
        setResult(null);
      }
      wasSquattingRef.current = snapshot.isSquatting;

      if (!snapshot.repWindowReady) return;

      const repWindow = pipelineRef.current.takeCompletedRepWindow();
      if (!repWindow) return;

      const model = modelRef.current;
      if (!model) {
        const biomech = pipelineRef.current.runBiomechOnRepWindow(
          repWindow,
          snapshot,
        );
        if (biomech) setResult(biomech);
        return;
      }
      if (inferenceBusyRef.current) {
        pendingRepsRef.current.push({ window: repWindow, snapshot });
        return;
      }
      void runInference(model, repWindow, snapshot);
    },
    [
      enabled,
      cameraAnglePreset,
      modelLoadStatus,
      modelReady,
      runtimeConfig,
      runInference,
      publishTracker,
      modelRef,
    ],
  );

  const overlaySeverityRef = useRef(new Float32Array(4));
  const overlaySeverity = useMemo(() => {
    if (!result) {
      overlaySeverityRef.current.fill(0);
      return overlaySeverityRef.current;
    }
    const next = predictionToSeverity(result);
    overlaySeverityRef.current.set(next);
    return overlaySeverityRef.current;
  }, [result]);

  const severity = useMemo(
    () => (result ? predictionToUiSeverity(result, runtimeConfig) : 0),
    [result, runtimeConfig],
  );

  const feedbackInput = useMemo(
    () => ({
      tracker: trackerLatestRef.current,
      result,
      repCountOnlyMode: repCountOnly,
      activeViewAngle,
    }),
    [tracker, result, repCountOnly, activeViewAngle],
  );

  const feedback = useMemo(
    () => buildTrackerFeedback(feedbackInput),
    [feedbackInput],
  );

  const vocalFeedback = useMemo(
    () => buildVocalFeedback(feedbackInput),
    [feedbackInput],
  );

  const displayTracker = tracker ?? trackerLatestRef.current;
  const phase = displayTracker?.phase ?? SquatPhase.Standing;
  const buffering =
    displayTracker?.calibrated === true &&
    displayTracker.isSquatting &&
    !displayTracker.repWindowReady;

  const reset = useCallback(() => {
    pipelineRef.current.reset();
    viewVoterRef.current.reset();
    trackerLatestRef.current = null;
    pendingRepsRef.current = [];
    setResult(null);
    setTracker(null);
    wasSquattingRef.current = false;
  }, []);

  return {
    onPoseFrame,
    onPoseLost,
    requestCalibration,
    overlaySeverity,
    severity,
    feedback,
    vocalFeedback,
    result,
    tracker: displayTracker,
    modelReady,
    modelLoading,
    modelError,
    repCountOnly,
    buffering,
    bufferLength: displayTracker?.activeRepFrameCount ?? 0,
    repCount: displayTracker?.repCount ?? 0,
    phase,
    phaseLabel: phaseLabel(phase),
    calibrated: displayTracker?.calibrated ?? false,
    calibrationRequested: displayTracker?.calibrationRequested ?? false,
    isSquatting: displayTracker?.isSquatting ?? false,
    repProgress: displayTracker?.repProgress ?? 0,
    hipKneeAngle: displayTracker?.hipKneeAngle ?? 0,
    repMinHipKneeAngle: displayTracker?.repMinHipKneeAngle ?? null,
    activeViewAngle,
    reset,
  };
}
