import { useEffect } from "react";
import { Text, View } from "react-native";
import type { SquatInferenceResult } from "@/lib/squat/squatTypes";

interface RepSummaryCardProps {
  result: SquatInferenceResult | null;
  visible: boolean;
  onHide: () => void;
}

export function RepSummaryCard({
  result,
  visible,
  onHide,
}: RepSummaryCardProps) {
  useEffect(() => {
    if (!visible || !result) return;
    const t = setTimeout(onHide, 3000);
    return () => clearTimeout(t);
  }, [visible, result, onHide]);

  if (!visible || !result) return null;

  return (
    <View className="absolute right-4 bottom-32 left-4 rounded-2xl border border-white/20 bg-black/85 p-4">
      <Text className="mb-1 font-bold text-base text-white">
        Rep {result.repNumber} — {result.isCorrect ? "Good form" : "Form issue"}
      </Text>
      {!result.isCorrect ? (
        <>
          <Text className="text-sm text-yellow-300">{result.feedback}</Text>
          <Text className="mt-2 text-xs text-white/50">
            Valgus {Math.round(result.errors.knee_valgus * 100)}% · Depth{" "}
            {Math.round(result.errors.insufficient_depth * 100)}% · Lean{" "}
            {Math.round(result.errors.forward_lean * 100)}%
          </Text>
        </>
      ) : (
        <Text className="text-green-300 text-sm">
          {Math.round(result.confidence * 100)}% confidence
        </Text>
      )}
    </View>
  );
}
