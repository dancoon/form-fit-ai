"""Export annotated reps as training-ready numpy arrays."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np

log = logging.getLogger("squat-annotate")

from annotation.config import AnnotationConfig


class DataExporter:
    """Exports annotated data for the training notebook / pipeline."""

    def __init__(self, config: AnnotationConfig) -> None:
        self.cfg = config

    def _resample_sequence(self, sequence: np.ndarray, target_length: int) -> np.ndarray:
        current_length = len(sequence)
        if current_length == target_length:
            return sequence

        indices = np.linspace(0, current_length - 1, target_length)
        resampled = np.zeros((target_length, sequence.shape[1]), dtype=np.float32)

        for i, idx in enumerate(indices):
            lower = int(np.floor(idx))
            upper = min(lower + 1, current_length - 1)
            alpha = idx - lower
            resampled[i] = (1 - alpha) * sequence[lower] + alpha * sequence[upper]

        return resampled

    def export_for_training(
        self,
        extracted_data: dict[str, dict[str, Any]],
        annotations: dict[str, list[dict[str, Any]]],
        target_sequence_length: int | None = None,
        output_path: Path | None = None,
    ) -> str:
        """Export annotated reps as (N, seq, 132) sequences with labels and error vectors."""
        target_length = target_sequence_length or self.cfg.target_sequence_length
        output_path = output_path or self.cfg.dataset_path

        sequences: list[np.ndarray] = []
        labels: list[int] = []
        error_vectors: list[list[int]] = []

        for video_name, video_annotations in annotations.items():
            if video_name not in extracted_data:
                log.warning("No landmarks for '%s', skipping", video_name)
                continue

            landmarks = extracted_data[video_name]["landmarks"]

            for ann in video_annotations:
                start = ann["start_frame"]
                end = ann["end_frame"]
                rep_landmarks = landmarks[start:end]

                if len(rep_landmarks) < 10:
                    continue

                rep_normalized = self._resample_sequence(rep_landmarks, target_length)
                sequences.append(rep_normalized)
                labels.append(ann["label"])
                error_vectors.append(ann["error_vector"])

        if not sequences:
            log.warning("No annotated sequences to export")
            return ""

        sequences_arr = np.array(sequences, dtype=np.float32)
        labels_arr = np.array(labels, dtype=np.int32)
        error_vectors_arr = np.array(error_vectors, dtype=np.float32)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        np.savez(
            output_path,
            sequences=sequences_arr,
            labels=labels_arr,
            error_vectors=error_vectors_arr,
        )

        n_correct = int(np.sum(labels_arr == 0))
        n_incorrect = int(np.sum(labels_arr == 1))
        log.info("Sequences: %s", sequences_arr.shape)
        log.info("Labels: %d correct, %d incorrect", n_correct, n_incorrect)

        return str(output_path)
