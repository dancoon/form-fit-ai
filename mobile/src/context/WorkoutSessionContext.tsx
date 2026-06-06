import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { SquatInferenceResult } from "@/lib/squat/squatTypes";
import {
  createSession,
  exportFailureReps,
  loadSessions,
  type RepRecord,
  repRecordFromCount,
  repRecordFromResult,
  type SessionStatus,
  saveSession,
  type WorkoutSessionData,
} from "@/lib/workout/workoutStorage";

interface WorkoutSessionContextValue {
  session: WorkoutSessionData | null;
  status: SessionStatus;
  startSession: (exerciseId: string, targetReps?: number | null) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  finishSession: () => Promise<WorkoutSessionData | null>;
  recordRep: (
    result: SquatInferenceResult,
    hipKneeAngleMin: number | null,
  ) => void;
  recordRepCount: (
    repNumber: number,
    hipKneeAngleMin: number | null,
  ) => void;
  exportFailures: () => Promise<string | null>;
  restSecondsRemaining: number | null;
  startRest: (seconds: number) => void;
  clearRest: () => void;
}

const WorkoutSessionContext = createContext<
  WorkoutSessionContextValue | undefined
>(undefined);

export function WorkoutSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<WorkoutSessionData | null>(null);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<
    number | null
  >(null);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearRestInterval = useCallback(() => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
  }, []);

  const startSession = useCallback(
    (exerciseId: string, targetReps: number | null = null) => {
      setSession(createSession(exerciseId, targetReps));
    },
    [],
  );

  const pauseSession = useCallback(() => {
    setSession((s) => (s ? { ...s, status: "paused" } : s));
  }, []);

  const resumeSession = useCallback(() => {
    setSession((s) => (s ? { ...s, status: "active" } : s));
  }, []);

  const finishSession = useCallback(async () => {
    if (!session) return null;
    const finished: WorkoutSessionData = {
      ...session,
      status: "finished",
      endedAt: Date.now(),
    };
    await saveSession(finished);
    setSession(finished);
    return finished;
  }, [session]);

  const recordRepCount = useCallback(
    (repNumber: number, hipKneeAngleMin: number | null) => {
      setSession((s) => {
        if (!s || s.status !== "active") return s;
        if (s.reps.some((r) => r.repNumber === repNumber)) return s;
        const rep: RepRecord = repRecordFromCount(repNumber, hipKneeAngleMin);
        return { ...s, reps: [...s.reps, rep] };
      });
    },
    [],
  );

  const recordRep = useCallback(
    (result: SquatInferenceResult, hipKneeAngleMin: number | null) => {
      setSession((s) => {
        if (!s || s.status !== "active") return s;
        const rep: RepRecord = repRecordFromResult(result, hipKneeAngleMin);
        const idx = s.reps.findIndex((r) => r.repNumber === result.repNumber);
        if (idx >= 0) {
          const reps = [...s.reps];
          reps[idx] = rep;
          return { ...s, reps };
        }
        return { ...s, reps: [...s.reps, rep] };
      });
    },
    [],
  );

  const exportFailures = useCallback(async () => {
    if (!session) return null;
    return exportFailureReps(session);
  }, [session]);

  const startRest = useCallback(
    (seconds: number) => {
      clearRestInterval();
      setRestSecondsRemaining(seconds);
      restIntervalRef.current = setInterval(() => {
        setRestSecondsRemaining((prev) => {
          if (prev === null || prev <= 1) {
            clearRestInterval();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearRestInterval],
  );

  const clearRest = useCallback(() => {
    clearRestInterval();
    setRestSecondsRemaining(null);
  }, [clearRestInterval]);

  useEffect(() => () => clearRestInterval(), [clearRestInterval]);

  const value = useMemo(
    () => ({
      session,
      status: session?.status ?? "idle",
      startSession,
      pauseSession,
      resumeSession,
      finishSession,
      recordRep,
      recordRepCount,
      exportFailures,
      restSecondsRemaining,
      startRest,
      clearRest,
    }),
    [
      session,
      startSession,
      pauseSession,
      resumeSession,
      finishSession,
      recordRep,
      recordRepCount,
      exportFailures,
      restSecondsRemaining,
      startRest,
      clearRest,
    ],
  );

  return (
    <WorkoutSessionContext.Provider value={value}>
      {children}
    </WorkoutSessionContext.Provider>
  );
}

export { loadSessions };

export function useWorkoutSession() {
  const ctx = useContext(WorkoutSessionContext);
  if (!ctx) {
    throw new Error(
      "useWorkoutSession must be used within WorkoutSessionProvider",
    );
  }
  return ctx;
}
