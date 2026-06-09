import { Asset } from "expo-asset";
import { devLog } from "@/lib/logging";
import {
  loadTensorflowModel,
  type TensorflowModelDelegate,
  type TfliteModel,
} from "react-native-fast-tflite";

const SQUAT_MODEL_MODULE = require("@/assets/models/squat_model.tflite");

function toLoadableUrl(uri: string): string {
  if (
    uri.startsWith("file://") ||
    uri.startsWith("http://") ||
    uri.startsWith("https://") ||
    uri.startsWith("asset://") ||
    uri.startsWith("content://")
  ) {
    return uri;
  }

  return uri.startsWith("/") ? `file://${uri}` : `file:///${uri}`;
}

/** Resolve bundled .tflite to a URL HybridAssetLoader can read on Android. */
export async function loadSquatModel(
  delegates: TensorflowModelDelegate[] = [],
): Promise<TfliteModel> {
  const asset = Asset.fromModule(SQUAT_MODEL_MODULE);
  await asset.downloadAsync();

  const uri = asset.localUri ?? asset.uri;
  if (!uri) {
    throw new Error("Failed to resolve squat model asset URI");
  }

  const model = await loadTensorflowModel(
    { url: toLoadableUrl(uri) },
    delegates,
  );
  devLog("[squat] model input shape", model.inputs[0]?.shape);
  return model;
}
