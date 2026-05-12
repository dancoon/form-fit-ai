import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { MockCameraFeed } from "@/components/MockCameraFeed";
import { WebGLOverlay } from "@/components/WebGLOverlay";
import { useAppSettings } from "@/context/AppSettingsContext";
import { useMockMLPipeline } from "@/hooks/useMockMLPipeline";

const SLIDER_WIDTH = 200;

/**
 * HomeScreen (Main Workout Screen)
 *
 * Implements architectural requirement Fix 5: Haptic Feedback Integration.
 */
export default function HomeScreen() {
  const { uLandmarks, uSeverity, severity, setSeverity, feedback } =
    useMockMLPipeline();
  const hasTriggeredHaptic = useRef(false);

  const { vocalFeedback } = useAppSettings();

  // Vocal Feedback Logic
  useEffect(() => {
    if (vocalFeedback && feedback) {
      // Stop any current speech before starting new one to avoid overlapping
      Speech.stop();
      Speech.speak(feedback, {
        rate: 1.0,
        pitch: 1.0,
      });
    }
  }, [feedback, vocalFeedback]);

  const sliderPos = useSharedValue(severity * SLIDER_WIDTH);
  const startPos = useRef(0);

  // Fix 5: Haptic Feedback Logic
  useEffect(() => {
    if (severity > 0.8) {
      if (!hasTriggeredHaptic.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        hasTriggeredHaptic.current = true;
      }
    } else {
      // Reset ref when dropping below threshold to allow re-triggering
      hasTriggeredHaptic.current = false;
    }
  }, [severity]);

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
          <Text className="mb-[5px] font-bold text-base text-white tracking-wider">
            ERROR SEVERITY: {(severity * 100).toFixed(0)}%
          </Text>

          {/* Real-time Vocal Guidance Display */}
          <View className="h-[40px] justify-center">
            {feedback ? (
              <Text className="text-center font-semibold text-yellow-400">
                {feedback}
              </Text>
            ) : null}
          </View>

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
