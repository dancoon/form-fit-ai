import { useEffect } from "react";
import { Text, View } from "react-native";
import { FEEDBACK } from "@/constants/feedbackStrings";
import { formatDevErrorScores } from "@/lib/squat/squatFeedback";
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
      <Text
        className={`text-sm ${result.isCorrect ? "text-green-300" : "text-yellow-300"}`}
      >
        {result.isCorrect ? FEEDBACK.goodForm : result.feedback}
      </Text>
      {__DEV__ ? (
        <Text className="mt-2 text-white/50 text-xs">
          {result.isCorrect
            ? `${Math.round(result.confidence * 100)}% confidence`
            : formatDevErrorScores(result.errors)}
        </Text>
      ) : null}
    </View>
  );
}
