import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MockCameraFeed } from "@/components/MockCameraFeed";
import { WebGLOverlay } from "@/components/WebGLOverlay";
import { useMockMLPipeline } from "@/hooks/useMockMLPipeline";

const SLIDER_WIDTH = 200;

/**
 * HomeScreen (Main Workout Screen)
 *
 * Integrates the Phase 1 Mock Pipeline and Phase 2 Shader Engine.
 * Stacks MockCameraFeed beneath the WebGL overlay and provides an interactive
 * severity slider using the modern RNGH v2 Gesture API.
 */
export default function HomeScreen() {
  const { uLandmarks, uSeverity, severity, setSeverity } = useMockMLPipeline();
  const insets = useSafeAreaInsets();

  const sliderPos = useSharedValue(severity * SLIDER_WIDTH);
  // useRef for start position avoids any-typed gesture context
  const startPos = useRef(0);

  // .runOnJS(true) runs the callbacks on the JS thread, so setSeverity
  // can be called directly — no runOnJS wrapper needed.
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
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* PHASE 3: STACKED ARCHITECTURE */}
      <View style={styles.viewerContainer}>
        {/* Layer 0: Mock Camera Feed */}
        <MockCameraFeed />

        {/* Layer 1: WebGL Shader Overlay */}
        <WebGLOverlay uLandmarks={uLandmarks} uSeverity={uSeverity} />
      </View>

      {/* PHASE 3: INTERACTIVE CONTROLS */}
      <View style={[styles.controlsContainer, { paddingTop: insets.top }]}>
        <View style={styles.glassCard}>
          <Text style={styles.label}>
            ERROR SEVERITY: {(severity * 100).toFixed(0)}%
          </Text>

          <View style={styles.sliderTrack}>
            <Animated.View style={[styles.sliderProgress, progressStyle]} />
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.sliderKnob, knobStyle]} />
            </GestureDetector>
          </View>

          <Text style={styles.hint}>Drag to simulate biomechanical error</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  viewerContainer: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 24,
    margin: 10,
  },
  controlsContainer: {
    padding: 20,
    paddingBottom: 20,
    alignItems: "center",
  },
  glassCard: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
  },
  label: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 15,
    letterSpacing: 1,
  },
  sliderTrack: {
    width: SLIDER_WIDTH + 24, // range + knob width
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
    justifyContent: "center",
    marginBottom: 15,
  },
  sliderProgress: {
    height: "100%",
    backgroundColor: "#FFF",
    borderRadius: 4,
  },
  sliderKnob: {
    position: "absolute",
    width: 24,
    height: 24,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 4,
    borderColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  hint: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    fontStyle: "italic",
  },
});
