import { View } from "react-native";

/** Semi-transparent body silhouette guide while calibrating. */
export function BodyOutlineGuide({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 items-center justify-center"
    >
      <View className="h-[72%] w-[42%] rounded-[80px] border-2 border-white/35 border-dashed" />
    </View>
  );
}
