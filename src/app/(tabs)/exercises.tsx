import { ScrollView, Text, TouchableOpacity, View } from "react-native";

const EXERCISES = [
  { id: "1", name: "Squats", active: true },
  { id: "2", name: "Deadlift", active: false },
  { id: "3", name: "Lunges", active: false },
  { id: "4", name: "Push-ups", active: false },
  { id: "5", name: "Overhead Press", active: false },
  { id: "6", name: "Plank", active: false },
  { id: "7", name: "Bench Press", active: false },
  { id: "8", name: "Pull-ups", active: false },
  { id: "9", name: "Barbell Rows", active: false },
  { id: "10", name: "Bicep Curls", active: false },
];

export default function ExercisesScreen() {
  return (
    <ScrollView className="flex-1 bg-black p-5 pt-safe">
      <Text className="mb-8 font-bold text-3xl text-white">Exercises</Text>

      {EXERCISES.map((item) => (
        <View
          key={item.id}
          className={`mb-4 flex-row items-center justify-between rounded-2xl border p-5 ${
            item.active
              ? "border-white bg-white/10"
              : "border-white/10 bg-white/5 opacity-40"
          }`}
        >
          <View>
            <Text
              className={`font-bold text-lg ${
                item.active ? "text-white" : "text-white/60"
              }`}
            >
              {item.name}
            </Text>
            {!item.active && (
              <Text className="mt-1 text-white/40 text-xs">
                Not available yet
              </Text>
            )}
          </View>

          {item.active ? (
            <TouchableOpacity className="rounded-full bg-white px-4 py-2">
              <Text className="font-bold text-black text-sm">SELECT</Text>
            </TouchableOpacity>
          ) : (
            <View className="rounded-full border border-white/20 px-3 py-1">
              <Text className="font-bold text-[10px] text-white/30 uppercase tracking-widest">
                Coming Soon
              </Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
