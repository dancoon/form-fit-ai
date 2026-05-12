import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function ModalScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-black p-5">
      <Text className="font-bold text-3xl text-white leading-8">Modal</Text>
      <Link href="/" dismissTo className="mt-4 py-4">
        <Text className="text-base text-white/50 leading-[30px]">
          Go to home screen
        </Text>
      </Link>
    </View>
  );
}
