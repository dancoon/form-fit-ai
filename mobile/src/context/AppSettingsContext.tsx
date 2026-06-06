import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  CameraAnglePreset,
  CameraFacing,
  PoseModelQuality,
  SensitivityPreset,
} from "@/lib/squat/squatConfig";

interface AppSettings {
  vocalFeedback: boolean;
  hapticFeedback: boolean;
  liveCuesEnabled: boolean;
  cameraFacing: CameraFacing;
  cameraAnglePreset: CameraAnglePreset;
  sensitivity: SensitivityPreset;
  developerMode: boolean;
  repCountOnlyMode: boolean;
  poseModelQuality: PoseModelQuality;
  hasSeenCameraGuide: boolean;
  hasCompletedOnboarding: boolean;
  toggleVocalFeedback: () => Promise<void>;
  toggleHapticFeedback: () => Promise<void>;
  toggleLiveCues: () => Promise<void>;
  setCameraFacing: (facing: CameraFacing) => Promise<void>;
  setCameraAnglePreset: (preset: CameraAnglePreset) => Promise<void>;
  setSensitivity: (preset: SensitivityPreset) => Promise<void>;
  toggleDeveloperMode: () => Promise<void>;
  setRepCountOnlyMode: (on: boolean) => Promise<void>;
  setPoseModelQuality: (quality: PoseModelQuality) => Promise<void>;
  markCameraGuideSeen: () => Promise<void>;
  markOnboardingComplete: () => Promise<void>;
  loading: boolean;
}

const AppSettingsContext = createContext<AppSettings | undefined>(undefined);

const KEYS = {
  vocal: "@vocal_feedback",
  haptic: "@haptic_feedback",
  liveCues: "@live_cues",
  camera: "@camera_facing",
  angle: "@camera_angle_preset",
  sensitivity: "@sensitivity",
  dev: "@developer_mode",
  repOnly: "@rep_count_only",
  poseModel: "@pose_model_quality",
  cameraGuide: "@camera_guide_seen",
  onboarding: "@onboarding_done",
} as const;

async function readBool(key: string, fallback: boolean): Promise<boolean> {
  const val = await AsyncStorage.getItem(key);
  return val === null ? fallback : val === "true";
}

async function writeBool(key: string, value: boolean): Promise<void> {
  await AsyncStorage.setItem(key, String(value));
}

export function AppSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [vocalFeedback, setVocalFeedback] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [liveCuesEnabled, setLiveCuesEnabled] = useState(true);
  const [cameraFacing, setCameraFacingState] = useState<CameraFacing>("back");
  const [cameraAnglePreset, setCameraAnglePresetState] =
    useState<CameraAnglePreset>("auto");
  const [sensitivity, setSensitivityState] =
    useState<SensitivityPreset>("normal");
  const [developerMode, setDeveloperMode] = useState(false);
  const [repCountOnlyMode, setRepCountOnlyModeState] = useState(false);
  const [poseModelQuality, setPoseModelQualityState] =
    useState<PoseModelQuality>("lite");
  const [hasSeenCameraGuide, setHasSeenCameraGuide] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setVocalFeedback(await readBool(KEYS.vocal, true));
        setHapticFeedback(await readBool(KEYS.haptic, true));
        setLiveCuesEnabled(await readBool(KEYS.liveCues, true));
        setDeveloperMode(await readBool(KEYS.dev, false));
        setRepCountOnlyModeState(await readBool(KEYS.repOnly, false));
        setHasSeenCameraGuide(await readBool(KEYS.cameraGuide, false));
        setHasCompletedOnboarding(await readBool(KEYS.onboarding, false));

        const cam = await AsyncStorage.getItem(KEYS.camera);
        if (cam === "front" || cam === "back") setCameraFacingState(cam);

        const angle = await AsyncStorage.getItem(KEYS.angle);
        if (angle === "front" || angle === "side" || angle === "auto")
          setCameraAnglePresetState(angle);

        const sens = await AsyncStorage.getItem(KEYS.sensitivity);
        if (sens === "beginner" || sens === "normal" || sens === "strict")
          setSensitivityState(sens);

        const poseModel = await AsyncStorage.getItem(KEYS.poseModel);
        if (poseModel === "lite" || poseModel === "full")
          setPoseModelQualityState(poseModel);
      } catch (e) {
        console.error("Failed to load settings", e);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const toggleVocalFeedback = useCallback(async () => {
    const next = !vocalFeedback;
    setVocalFeedback(next);
    await writeBool(KEYS.vocal, next);
  }, [vocalFeedback]);

  const toggleHapticFeedback = useCallback(async () => {
    const next = !hapticFeedback;
    setHapticFeedback(next);
    await writeBool(KEYS.haptic, next);
  }, [hapticFeedback]);

  const toggleLiveCues = useCallback(async () => {
    const next = !liveCuesEnabled;
    setLiveCuesEnabled(next);
    await writeBool(KEYS.liveCues, next);
  }, [liveCuesEnabled]);

  const setCameraFacing = useCallback(async (facing: CameraFacing) => {
    setCameraFacingState(facing);
    await AsyncStorage.setItem(KEYS.camera, facing);
  }, []);

  const setCameraAnglePreset = useCallback(
    async (preset: CameraAnglePreset) => {
      setCameraAnglePresetState(preset);
      await AsyncStorage.setItem(KEYS.angle, preset);
    },
    [],
  );

  const setSensitivity = useCallback(async (preset: SensitivityPreset) => {
    setSensitivityState(preset);
    await AsyncStorage.setItem(KEYS.sensitivity, preset);
  }, []);

  const toggleDeveloperMode = useCallback(async () => {
    const next = !developerMode;
    setDeveloperMode(next);
    await writeBool(KEYS.dev, next);
  }, [developerMode]);

  const setRepCountOnlyMode = useCallback(async (on: boolean) => {
    setRepCountOnlyModeState(on);
    await writeBool(KEYS.repOnly, on);
  }, []);

  const setPoseModelQuality = useCallback(async (quality: PoseModelQuality) => {
    setPoseModelQualityState(quality);
    await AsyncStorage.setItem(KEYS.poseModel, quality);
  }, []);

  const markCameraGuideSeen = useCallback(async () => {
    setHasSeenCameraGuide(true);
    await writeBool(KEYS.cameraGuide, true);
  }, []);

  const markOnboardingComplete = useCallback(async () => {
    setHasCompletedOnboarding(true);
    await writeBool(KEYS.onboarding, true);
  }, []);

  const value = useMemo(
    () => ({
      vocalFeedback,
      hapticFeedback,
      liveCuesEnabled,
      cameraFacing,
      cameraAnglePreset,
      sensitivity,
      developerMode,
      repCountOnlyMode,
      poseModelQuality,
      hasSeenCameraGuide,
      hasCompletedOnboarding,
      toggleVocalFeedback,
      toggleHapticFeedback,
      toggleLiveCues,
      setCameraFacing,
      setCameraAnglePreset,
      setSensitivity,
      toggleDeveloperMode,
      setRepCountOnlyMode,
      setPoseModelQuality,
      markCameraGuideSeen,
      markOnboardingComplete,
      loading,
    }),
    [
      vocalFeedback,
      hapticFeedback,
      liveCuesEnabled,
      cameraFacing,
      cameraAnglePreset,
      sensitivity,
      developerMode,
      repCountOnlyMode,
      poseModelQuality,
      hasSeenCameraGuide,
      hasCompletedOnboarding,
      toggleVocalFeedback,
      toggleHapticFeedback,
      toggleLiveCues,
      setCameraFacing,
      setCameraAnglePreset,
      setSensitivity,
      toggleDeveloperMode,
      setRepCountOnlyMode,
      setPoseModelQuality,
      markCameraGuideSeen,
      markOnboardingComplete,
      loading,
    ],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error(
      "useAppSettings must be used within an AppSettingsProvider",
    );
  }
  return context;
}
