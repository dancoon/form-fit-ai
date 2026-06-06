import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SquatInferenceResult } from "@/lib/squat/squatTypes";

export type SessionStatus = "idle" | "active" | "paused" | "finished";

export interface RepRecord {
  repNumber: number;
  timestamp: number;
  isCorrect: boolean | null;
  errors: {
    knee_valgus: number;
    insufficient_depth: number;
    forward_lean: number;
  } | null;
  hipKneeAngleMin: number | null;
}

export interface WorkoutSessionData {
  id: string;
  exerciseId: string;
  startedAt: number;
  endedAt: number | null;
  status: SessionStatus;
  targetReps: number | null;
  reps: RepRecord[];
}

const SESSIONS_KEY = "@workout_sessions";
const MAX_STORED = 50;

export async function loadSessions(): Promise<WorkoutSessionData[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorkoutSessionData[];
  } catch {
    return [];
  }
}

export async function saveSession(session: WorkoutSessionData): Promise<void> {
  const sessions = await loadSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  await AsyncStorage.setItem(
    SESSIONS_KEY,
    JSON.stringify(sessions.slice(0, MAX_STORED)),
  );
}

export function createSession(
  exerciseId: string,
  targetReps: number | null = null,
): WorkoutSessionData {
  return {
    id: `${Date.now()}`,
    exerciseId,
    startedAt: Date.now(),
    endedAt: null,
    status: "active",
    targetReps,
    reps: [],
  };
}

export function repRecordFromResult(
  result: SquatInferenceResult,
  hipKneeAngleMin: number | null,
): RepRecord {
  return {
    repNumber: result.repNumber,
    timestamp: Date.now(),
    isCorrect: result.isCorrect,
    errors: { ...result.errors },
    hipKneeAngleMin,
  };
}

export function repRecordFromCount(
  repNumber: number,
  hipKneeAngleMin: number | null,
): RepRecord {
  return {
    repNumber,
    timestamp: Date.now(),
    isCorrect: null,
    errors: null,
    hipKneeAngleMin,
  };
}

export interface ExportedRepFailure {
  repNumber: number;
  timestamp: number;
  result: SquatInferenceResult;
  /** Base64-ish JSON of raw window omitted — store as nested arrays in dev export */
  rawWindow?: number[][];
}

export async function exportFailureReps(
  session: WorkoutSessionData,
): Promise<string> {
  return JSON.stringify(
    {
      sessionId: session.id,
      exportedAt: Date.now(),
      reps: session.reps.filter((r) => r.isCorrect === false),
    },
    null,
    2,
  );
}
