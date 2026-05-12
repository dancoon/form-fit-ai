import { ScrollView, Switch, Text, View } from "react-native";
import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { useAppSettings } from "@/context/AppSettingsContext";

interface Section {
  title: string;
  icon: IconSymbolName;
  value?: string;
  isToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: () => void;
}

export default function SettingsScreen() {
  const { vocalFeedback, toggleVocalFeedback } = useAppSettings();

  const sections: Section[] = [
    {
      title: "Vocal Feedback",
      icon: "paperplane.fill",
      isToggle: true,
      toggleValue: vocalFeedback,
      onToggle: toggleVocalFeedback,
    },
    { title: "Camera Permissions", icon: "paperplane.fill", value: "Granted" },
    { title: "App Version", icon: "chevron.right", value: "1.0.0" },
  ];

  return (
    <ScrollView className="flex-1 bg-black p-5 pt-safe">
      <Text className="mb-8 font-bold text-3xl text-white">Settings</Text>

      <View className="rounded-3xl border border-white/10 bg-white/5 p-2">
        {sections.map((section, index) => (
          <View
            key={section.title}
            className={`flex-row items-center justify-between p-5 ${
              index !== sections.length - 1 ? "border-white/5 border-b" : ""
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

      <Text className="mt-8 text-center text-[12px] text-white/20 uppercase tracking-widest">
        FormFit AI • 2026
      </Text>
    </ScrollView>
  );
}
