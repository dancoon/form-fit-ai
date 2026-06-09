import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useWorkoutSession } from "@/context/WorkoutSessionContext";
import {
  feedbackFromRepErrors,
  formatDevErrorScores,
} from "@/lib/squat/squatFeedback";

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const { session } = useWorkoutSession();

  const reps = session?.reps ?? [];
  const good = reps.filter((r) => r.isCorrect === true).length;
  const total = reps.length;
  const pct = total > 0 ? Math.round((good / total) * 100) : 0;

  return (
    <View className="flex-1 bg-black p-6 pt-safe">
      <Text className="mb-2 font-bold text-3xl text-white">Set complete</Text>
      {params.sessionId ? (
        <Text className="mb-6 text-white/40 text-xs">
          Session {params.sessionId}
        </Text>
      ) : null}

      <View className="mb-6 rounded-2xl bg-white/10 p-5">
        <Text className="font-bold text-4xl text-white">{total}</Text>
        <Text className="text-white/60">Total reps</Text>
        <Text className="mt-4 font-bold text-2xl text-green-300">{pct}%</Text>
        <Text className="text-white/60">Good form</Text>
      </View>

      {reps.length > 0 ? (
        <View className="rounded-2xl bg-white/5 p-4">
          {reps.map((r) => (
            <View key={r.repNumber} className="mb-3">
              <Text className="text-sm text-white/80">
                Rep {r.repNumber}:{" "}
                {r.isCorrect === null
                  ? "—"
                  : r.isCorrect
                    ? "Good"
                    : "Form issue"}
              </Text>
              {r.isCorrect === false && r.errors ? (
                <>
                  <Text className="mt-0.5 text-sm text-yellow-300">
                    {feedbackFromRepErrors(r.errors)}
                  </Text>
                  {__DEV__ ? (
                    <Text className="mt-0.5 text-white/40 text-xs">
                      {formatDevErrorScores(r.errors)}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        onPress={() => router.replace("/(tabs)")}
        className="mt-auto rounded-full bg-white py-4"
      >
        <Text className="text-center font-bold text-black">Done</Text>
      </TouchableOpacity>
    </View>
  );
}
