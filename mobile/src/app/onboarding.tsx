import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useAppSettings } from "@/context/AppSettingsContext";

const STEPS = [
  {
    title: "Camera access",
    body: "FormFit needs your camera to track squat form in real time.",
  },
  {
    title: "Stand sideways",
    body: "Place the phone 6–8 ft away. Use the back camera and keep your full body in frame.",
  },
  {
    title: "Calibrate & squat",
    body: "Tap when ready to calibrate standing pose, then perform controlled squats.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { markOnboardingComplete, hasCompletedOnboarding, loading } =
    useAppSettings();

  useEffect(() => {
    if (!loading && hasCompletedOnboarding) {
      router.replace("/(tabs)");
    }
  }, [loading, hasCompletedOnboarding, router]);

  const finish = async () => {
    await markOnboardingComplete();
    router.replace("/(tabs)");
  };

  return (
    <View className="flex-1 bg-black px-6 pt-safe">
      <Text className="mt-8 mb-8 font-bold text-3xl text-white">Welcome</Text>
      {STEPS.map((step, i) => (
        <View key={step.title} className="mb-6 rounded-2xl bg-white/5 p-5">
          <Text className="mb-2 font-bold text-white">
            {i + 1}. {step.title}
          </Text>
          <Text className="text-sm text-white/70 leading-6">{step.body}</Text>
        </View>
      ))}
      <TouchableOpacity
        onPress={() => void finish()}
        className="mt-auto mb-8 rounded-full bg-white py-4"
      >
        <Text className="text-center font-bold text-black">Get started</Text>
      </TouchableOpacity>
    </View>
  );
}
