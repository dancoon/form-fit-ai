import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { DemoViewer } from "@/components/DemoViewer";

/**
 * ModalScreen
 * Displays the 3D Corrective Demonstration viewer.
 */
export default function ModalScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />

      {/* Header Area */}
      <View className="flex-row items-center justify-between p-5 pt-safe">
        <View>
          <Text className="text-[12px] text-white/50 uppercase tracking-widest">
            Corrective Guidance
          </Text>
          <Text className="font-bold text-2xl text-white">
            Correct Squat Form
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
        >
          <Text className="font-bold text-white text-xl">×</Text>
        </TouchableOpacity>
      </View>

      {/* 3D Demo Content */}
      <View className="flex-1">
        <DemoViewer />
      </View>

      {/* Footer / Instructions */}
      <View className="p-10">
        <Text className="text-center text-[13px] text-white/40 leading-5">
          Use one finger to rotate the model.{"\n"}
          Observe the hip-to-knee alignment carefully.
        </Text>
      </View>

      {/* Native close button hint for Android/iOS */}
      {Platform.OS === "ios" && (
        <View className="absolute right-0 bottom-10 left-0 items-center">
          <View className="h-1 w-10 rounded-full bg-white/20" />
        </View>
      )}
    </View>
  );
}
