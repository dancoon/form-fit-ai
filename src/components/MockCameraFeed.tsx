import type React from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * MockCameraFeed
 *
 * A placeholder for the native camera feed.
 * In a production environment, this would be replaced by a Camera component
 * that binds its texture directly to the GPU as a WebGLTexture.
 */
export const MockCameraFeed: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.text}>MOCK CAMERA FEED</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 20,
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
  },
  text: {
    color: "#666",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 2,
  },
});
