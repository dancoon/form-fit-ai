import { type Href, useRouter } from "expo-router";
import { useRef } from "react";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useWorkoutSession } from "@/context/WorkoutSessionContext";
import type {
  CameraAnglePreset,
  CameraFacing,
  PoseModelQuality,
  SensitivityPreset,
} from "@/lib/squat/squatConfig";

export default function SettingsScreen() {
  const router = useRouter();
  const versionTapRef = useRef({ count: 0, last: 0 });
  const {
    vocalFeedback,
    hapticFeedback,
    liveCuesEnabled,
    cameraFacing,
    cameraAnglePreset,
    sensitivity,
    developerMode,
    toggleVocalFeedback,
    toggleHapticFeedback,
    toggleLiveCues,
    setCameraFacing,
    setCameraAnglePreset,
    setSensitivity,
    toggleDeveloperMode,
    poseModelQuality,
    setPoseModelQuality,
  } = useAppSettings();
  const { exportFailures } = useWorkoutSession();

  const onVersionTap = () => {
    const now = Date.now();
    if (now - versionTapRef.current.last > 2000)
      versionTapRef.current.count = 0;
    versionTapRef.current.last = now;
    versionTapRef.current.count += 1;
    if (versionTapRef.current.count >= 5) {
      void toggleDeveloperMode();
      versionTapRef.current.count = 0;
    }
  };

  const sensitivities: SensitivityPreset[] = ["beginner", "normal", "strict"];
  const cameras: CameraFacing[] = ["back", "front"];

  const rows: {
    title: string;
    icon: IconSymbolName;
    isToggle?: boolean;
    toggleValue?: boolean;
    onToggle?: () => void;
    value?: string;
    action?: () => void;
  }[] = [
    {
      title: "Vocal feedback",
      icon: "paperplane.fill",
      isToggle: true,
      toggleValue: vocalFeedback,
      onToggle: () => void toggleVocalFeedback(),
    },
    {
      title: "Haptic feedback",
      icon: "paperplane.fill",
      isToggle: true,
      toggleValue: hapticFeedback,
      onToggle: () => void toggleHapticFeedback(),
    },
    {
      title: "Live form cues",
      icon: "paperplane.fill",
      isToggle: true,
      toggleValue: liveCuesEnabled,
      onToggle: () => void toggleLiveCues(),
    },
    {
      title: "Developer mode",
      icon: "paperplane.fill",
      isToggle: true,
      toggleValue: developerMode,
      onToggle: () => void toggleDeveloperMode(),
    },
  ];

  return (
    <ScrollView className="flex-1 bg-black p-5 pt-safe">
      <Text className="mb-8 font-bold text-3xl text-white">Settings</Text>

      <Text className="mb-2 font-bold text-sm text-white/50 uppercase">
        Camera
      </Text>
      <View className="mb-6 flex-row gap-2">
        {cameras.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => void setCameraFacing(c)}
            className={`flex-1 rounded-xl border p-3 ${
              cameraFacing === c
                ? "border-white bg-white/15"
                : "border-white/10 bg-white/5"
            }`}
          >
            <Text className="text-center font-bold text-sm text-white capitalize">
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="mb-2 font-bold text-sm text-white/50 uppercase">
        Sensitivity
      </Text>
      <View className="mb-6 flex-row gap-2">
        {sensitivities.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => void setSensitivity(s)}
            className={`flex-1 rounded-xl border p-3 ${
              sensitivity === s
                ? "border-white bg-white/15"
                : "border-white/10 bg-white/5"
            }`}
          >
            <Text className="text-center font-bold text-white text-xs capitalize">
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="mb-2 font-bold text-sm text-white/50 uppercase">
        View angle preset
      </Text>
      <View className="mb-6 flex-row gap-2">
        {(["auto", "side", "front"] as CameraAnglePreset[]).map((a) => (
          <TouchableOpacity
            key={a}
            onPress={() => void setCameraAnglePreset(a)}
            className={`flex-1 rounded-xl border p-3 ${
              cameraAnglePreset === a
                ? "border-white bg-white/15"
                : "border-white/10 bg-white/5"
            }`}
          >
            <Text className="text-center font-bold text-sm text-white capitalize">
              {a}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text className="mb-2 font-bold text-sm text-white/50 uppercase">
        Pose model
      </Text>
      <View className="mb-6 flex-row gap-2">
        {(["lite", "full"] as PoseModelQuality[]).map((q) => (
          <TouchableOpacity
            key={q}
            onPress={() => void setPoseModelQuality(q)}
            className={`flex-1 rounded-xl border p-3 ${
              poseModelQuality === q
                ? "border-white bg-white/15"
                : "border-white/10 bg-white/5"
            }`}
          >
            <Text className="text-center font-bold text-sm text-white capitalize">
              {q}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text className="-mt-4 mb-6 text-center text-[11px] text-white/40">
        Full model requires pose_landmarker_full.task in assets (restart pose)
      </Text>

      <View className="rounded-3xl border border-white/10 bg-white/5 p-2">
        {rows.map((section, index) => (
          <View
            key={section.title}
            className={`flex-row items-center justify-between p-5 ${
              index !== rows.length - 1 ? "border-white/5 border-b" : ""
            }`}
          >
            <View className="flex-row items-center gap-4">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <IconSymbol name={section.icon} size={20} color="#fff" />
              </View>
              <Text className="font-medium text-base text-white">
                {section.title}
              </Text>
            </View>

            {section.isToggle ? (
              <Switch
                value={section.toggleValue}
                onValueChange={section.onToggle}
                trackColor={{ false: "#333", true: "#fff" }}
                thumbColor={section.toggleValue ? "#000" : "#999"}
                ios_backgroundColor="#333"
              />
            ) : (
              <Text className="text-white/40">{section.value}</Text>
            )}
          </View>
        ))}
      </View>

      {developerMode ? (
        <TouchableOpacity
          onPress={() => {
            void exportFailures().then((json) => {
              if (json) console.log("[dev] failure export", json);
            });
          }}
          className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4"
        >
          <Text className="text-center text-sm text-yellow-200">
            Export failed reps (console)
          </Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={() => router.push("/onboarding" as Href)}
        className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4"
      >
        <Text className="text-center text-white/80">Replay onboarding</Text>
      </TouchableOpacity>

      <Text
        onPress={onVersionTap}
        className="mt-8 text-center text-[12px] text-white/20 uppercase tracking-widest"
      >
        FormFit AI · 1.0.0
      </Text>
    </ScrollView>
  );
}
