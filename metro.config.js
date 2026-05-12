const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Add support for 3D model files
config.resolver.assetExts.push("glb", "gltf", "obj", "mtl");

module.exports = withNativeWind(config, { input: "./src/global.css" });
