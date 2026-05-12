import { useRef } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { MockCameraFeed } from "@/components/MockCameraFeed";
import { WebGLOverlay } from "@/components/WebGLOverlay";
import { useMockMLPipeline } from "@/hooks/useMockMLPipeline";

const SLIDER_WIDTH = 200;

/**
 * HomeScreen (Main Workout Screen)
 *
 * This screen integrates the Phase 1 Mock Pipeline and Phase 2 Shader Engine.
 * It provides a visual stack of the Camera Feed and the WebGL indicator overlay,
 * with a custom glassmorphic slider to control error severity in real-time.
 *
 * Enforces NativeWind (Tailwind CSS) for all layout and styling.
 */
export default function HomeScreen() {
  const { uLandmarks, uSeverity, severity, setSeverity } = useMockMLPipeline();

  const sliderPos = useSharedValue(severity * SLIDER_WIDTH);
  const startPos = useRef(0);

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      startPos.current = sliderPos.value;
    })
    .onUpdate((event) => {
      const nextPos = Math.max(
        0,
        Math.min(SLIDER_WIDTH, startPos.current + event.translationX),
      );
      sliderPos.value = nextPos;
      setSeverity(nextPos / SLIDER_WIDTH);
    });

  // Reanimated style objects are the only exception where the 'style' prop is utilized,
  // as it is required for performant 60fps UI thread animations.
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sliderPos.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: sliderPos.value,
  }));

  return (
    <View className="flex-1 bg-black pb-safe">
      {/* PHASE 3: STACKED ARCHITECTURE */}
      <View className="m-[10px] flex-1 overflow-hidden rounded-[24px]">
        {/* Layer 0: Mock Camera Feed */}
        <MockCameraFeed />

        {/* Layer 1: WebGL Shader Overlay */}
        <WebGLOverlay uLandmarks={uLandmarks} uSeverity={uSeverity} />
      </View>

      {/* PHASE 3: INTERACTIVE CONTROLS */}
      <View className="items-center p-5 pt-safe">
        <View className="w-full items-center rounded-[20px] border border-white/20 bg-white/10 p-5">
          <Text className="mb-[15px] font-bold text-base text-white tracking-wider">
            ERROR SEVERITY: {(severity * 100).toFixed(0)}%
          </Text>

          <View className="mb-[15px] h-2 w-[224px] justify-center rounded-full bg-white/10">
            <Animated.View
              className="h-full rounded-full bg-white"
              style={progressStyle}
            />
            <GestureDetector gesture={panGesture}>
              <Animated.View
                className="absolute h-6 w-6 rounded-full border-[4px] border-black bg-white shadow-lg"
                style={knobStyle}
              />
            </GestureDetector>
          </View>

          <Text className="text-[12px] text-white/50 italic">
            Drag to simulate biomechanical error
          </Text>
        </View>
      </View>
    </View>
  );
}
