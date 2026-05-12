import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

interface AppSettings {
  vocalFeedback: boolean;
  toggleVocalFeedback: () => Promise<void>;
  loading: boolean;
}

const AppSettingsContext = createContext<AppSettings | undefined>(undefined);

const VOCAL_FEEDBACK_KEY = "@vocal_feedback";

export function AppSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [vocalFeedback, setVocalFeedback] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const val = await AsyncStorage.getItem(VOCAL_FEEDBACK_KEY);
        if (val !== null) {
          setVocalFeedback(val === "true");
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const toggleVocalFeedback = async () => {
    try {
      const newVal = !vocalFeedback;
      setVocalFeedback(newVal);
      await AsyncStorage.setItem(VOCAL_FEEDBACK_KEY, String(newVal));
    } catch (e) {
      console.error("Failed to save setting", e);
    }
  };

  return (
    <AppSettingsContext.Provider
      value={{ vocalFeedback, toggleVocalFeedback, loading }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error(
      "useAppSettings must be used within an AppSettingsProvider",
    );
  }
  return context;
}
