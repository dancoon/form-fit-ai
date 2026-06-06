import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { TfliteModel } from "react-native-fast-tflite";
import {
  loadSquatModelWithRetry,
  type ModelLoadAttemptResult,
} from "@/hooks/squatModelLoad";
import { devLog, logError } from "@/lib/logging";
import { loadSquatModel } from "@/lib/squat/loadSquatModel";

export type SquatModelLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; model: TfliteModel }
  | { status: "rep_count_only" }
  | { status: "error"; error: Error };

function applyLoadResult(
  result: ModelLoadAttemptResult,
  modelRef: MutableRefObject<TfliteModel | null>,
  setLoadState: Dispatch<SetStateAction<SquatModelLoadState>>,
): void {
  if (result.status === "loaded") {
    devLog("[squat] model loaded", {
      inputs: result.model.inputs,
      outputs: result.model.outputs,
    });
    modelRef.current = result.model;
    setLoadState({ status: "loaded", model: result.model });
    return;
  }
  logError("squat", result.error);
  modelRef.current = null;
  setLoadState({ status: "error", error: result.error });
}

export function useSquatModel(enabled: boolean, repCountOnlyMode: boolean) {
  const [loadState, setLoadState] = useState<SquatModelLoadState>({
    status: "idle",
  });
  const modelRef = useRef<TfliteModel | null>(null);

  const degradeToRepCountOnly = useCallback(() => {
    modelRef.current = null;
    setLoadState({ status: "rep_count_only" });
  }, []);

  useEffect(() => {
    if (!enabled) {
      modelRef.current = null;
      setLoadState({ status: "idle" });
      return;
    }

    if (repCountOnlyMode) {
      modelRef.current = null;
      setLoadState({ status: "rep_count_only" });
      return;
    }

    let cancelled = false;
    setLoadState({ status: "loading" });

    const load = async () => {
      const result = await loadSquatModelWithRetry(loadSquatModel);
      if (cancelled) return;
      applyLoadResult(result, modelRef, setLoadState);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, repCountOnlyMode]);

  const modelReady =
    loadState.status === "loaded" || loadState.status === "rep_count_only";
  const modelLoading = enabled && loadState.status === "loading";
  const modelError =
    loadState.status === "error" ? loadState.error.message : null;
  const repCountOnly =
    loadState.status === "rep_count_only" || loadState.status === "error";

  return {
    loadState,
    modelRef,
    modelReady,
    modelLoading,
    modelError,
    repCountOnly,
    degradeToRepCountOnly,
  };
}
