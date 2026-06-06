import "@/global.css";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppSettingsProvider } from "@/context/AppSettingsContext";
import { WorkoutSessionProvider } from "@/context/WorkoutSessionContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppSettingsProvider>
        <WorkoutSessionProvider>
          <ThemeProvider value={DarkTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="workout-summary"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="demo" options={{ headerShown: false }} />
              <Stack.Screen
                name="modal"
                options={{ presentation: "modal", title: "Modal" }}
              />
            </Stack>
            <StatusBar style="light" />
          </ThemeProvider>
        </WorkoutSessionProvider>
      </AppSettingsProvider>
    </GestureHandlerRootView>
  );
}
