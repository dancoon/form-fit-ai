const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Add support for 3D model files and MediaPipe pose assets
config.resolver.assetExts.push("glb", "gltf", "obj", "mtl", "tflite", "task");

module.exports = withNativeWind(config, { input: "./src/global.css" });
