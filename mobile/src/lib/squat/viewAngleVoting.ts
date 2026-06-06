import { inferViewAngle } from "@/lib/squat/repMetrics";
import type { ResolvedViewAngle } from "@/lib/squat/squatConfig";

/** Frames to accumulate before committing auto-detected camera angle. */
export const AUTO_VIEW_VOTE_FRAME_THRESHOLD = 24;

export class ViewAngleVoter {
  private votes = { side: 0, front: 0 };

  reset(): void {
    this.votes = { side: 0, front: 0 };
  }

  /** Returns resolved view when vote threshold reached; otherwise null. */
  vote(frame: Float32Array): ResolvedViewAngle | null {
    const inferred = inferViewAngle(frame);
    this.votes[inferred] += 1;
    const total = this.votes.side + this.votes.front;
    if (total < AUTO_VIEW_VOTE_FRAME_THRESHOLD) {
      return null;
    }
    const next: ResolvedViewAngle =
      this.votes.side >= this.votes.front ? "side" : "front";
    this.reset();
    return next;
  }
}
