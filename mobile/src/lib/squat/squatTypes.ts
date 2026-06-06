import type { SquatErrorKey } from "@/lib/squat/constants";
import type { SquatPhase } from "@/lib/squat/repDetector";

export interface SquatPrediction {
  isCorrect: boolean;
  confidence: number;
  incorrectProbability: number;
  errors: Record<SquatErrorKey, number>;
  kneeAngle: number;
}

export interface SquatInferenceResult extends SquatPrediction {
  feedback: string;
  repNumber: number;
  phase: SquatPhase;
}
