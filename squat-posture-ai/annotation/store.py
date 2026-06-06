"""Persistent storage for per-rep human annotations."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

log = logging.getLogger("squat-annotate")


class AnnotationStore:
    """Stores and manages rep annotations."""

    def __init__(self, output_dir: Path | str, *, log_load: bool = True) -> None:
        self.output_dir = Path(output_dir)
        self.annotations: dict[str, list[dict[str, Any]]] = {}
        self._load_existing(log_load=log_load)

    def _annotations_path(self) -> Path:
        return self.output_dir / "annotations.json"

    def _load_existing(self, *, log_load: bool) -> None:
        path = self._annotations_path()
        if path.exists():
            self.annotations = json.loads(path.read_text(encoding="utf-8"))
            if log_load:
                total = sum(len(v) for v in self.annotations.values())
                log.info("Loaded %d existing annotation(s) from %s", total, path)

    def save(self) -> None:
        path = self._annotations_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.annotations, indent=2), encoding="utf-8")
        total = sum(len(v) for v in self.annotations.values())
        log.info("Saved %d annotation(s) to %s", total, path)

    def annotate_rep(
        self,
        video_name: str,
        rep_index: int,
        start_frame: int,
        end_frame: int,
        is_correct: bool,
        knee_valgus: bool = False,
        insufficient_depth: bool = False,
        forward_lean: bool = False,
        notes: str = "",
    ) -> None:
        if video_name not in self.annotations:
            self.annotations[video_name] = []

        annotation = {
            "rep_index": rep_index,
            "start_frame": start_frame,
            "end_frame": end_frame,
            "label": 0 if is_correct else 1,
            "is_correct": is_correct,
            "errors": {
                "knee_valgus": knee_valgus,
                "insufficient_depth": insufficient_depth,
                "forward_lean": forward_lean,
            },
            "error_vector": [
                int(knee_valgus),
                int(insufficient_depth),
                int(forward_lean),
            ],
            "notes": notes,
        }

        existing_idx = None
        for i, a in enumerate(self.annotations[video_name]):
            if a["rep_index"] == rep_index:
                existing_idx = i
                break

        if existing_idx is not None:
            self.annotations[video_name][existing_idx] = annotation
        else:
            self.annotations[video_name].append(annotation)

    def get_rep_annotation(self, video_name: str, rep_index: int) -> dict[str, Any] | None:
        for a in self.annotations.get(video_name, []):
            if a["rep_index"] == rep_index:
                return a
        return None

    def is_rep_annotated(self, video_name: str, rep_index: int) -> bool:
        return self.get_rep_annotation(video_name, rep_index) is not None

    def label_summary(self, annotation: dict[str, Any] | None) -> str:
        if annotation is None:
            return ""
        if annotation["is_correct"]:
            return "Correct"
        errs = annotation.get("errors", {})
        parts = [k.replace("_", " ") for k, v in errs.items() if v]
        return ", ".join(parts) if parts else "Incorrect"

    def get_video_progress(self, video_name: str, num_reps: int) -> dict[str, float | int]:
        annotated = sum(
            1 for i in range(num_reps) if self.is_rep_annotated(video_name, i)
        )
        return {
            "annotated": annotated,
            "total": num_reps,
            "remaining": num_reps - annotated,
            "progress_pct": annotated / max(1, num_reps) * 100,
        }

    def get_progress(self, all_reps: dict[str, list[tuple[int, int]]]) -> dict[str, float | int]:
        total_reps = sum(len(r) for r in all_reps.values())
        annotated = sum(len(v) for v in self.annotations.values())
        return {
            "total_reps": total_reps,
            "annotated": annotated,
            "remaining": total_reps - annotated,
            "progress_pct": annotated / max(1, total_reps) * 100,
        }
