import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function ModalScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-5">
      <Text className="font-bold text-3xl text-foreground leading-8">
        This is a modal
      </Text>
      <Link href="/" dismissTo className="mt-4 py-4">
        <Text className="text-[#0a7ea4] text-base leading-[30px]">
          Go to home screen
        </Text>
      </Link>
    </View>
  );
}
