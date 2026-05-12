import type React from "react";
import { Text, View } from "react-native";

/**
 * MockCameraFeed
 *
 * A placeholder for the native camera feed.
 * In a production environment, this would be replaced by a Camera component
 * that binds its texture directly to the GPU as a WebGLTexture.
 */
export const MockCameraFeed: React.FC = () => {
  return (
    <View className="absolute inset-0 items-center justify-center bg-[#1A1A1A]">
      <View className="rounded-lg border border-[#444] p-5">
        <Text className="color-[#666] font-semibold text-lg tracking-[2px]">
          MOCK CAMERA FEED
        </Text>
      </View>
    </View>
  );
};
