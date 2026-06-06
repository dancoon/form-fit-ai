import { Modal, Text, TouchableOpacity, View } from "react-native";
import { FEEDBACK } from "@/constants/feedbackStrings";

interface CameraSetupGuideProps {
  visible: boolean;
  onDismiss: () => void;
}

export function CameraSetupGuide({
  visible,
  onDismiss,
}: CameraSetupGuideProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/80 p-6">
        <View className="w-full max-w-sm rounded-3xl border border-white/20 bg-zinc-900 p-6">
          <Text className="mb-3 font-bold text-lg text-white">
            Camera setup
          </Text>
          <Text className="mb-2 text-sm text-white/80 leading-6">
            {FEEDBACK.standSideways}
          </Text>
          <Text className="mb-6 text-sm text-white/60 leading-6">
            Use the back camera, stand sideways to the phone, and keep your full
            body visible from head to feet.
          </Text>
          <TouchableOpacity
            onPress={onDismiss}
            className="rounded-full bg-white py-3"
          >
            <Text className="text-center font-bold text-black">Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
