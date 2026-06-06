"""Programmatic batch annotation for reps."""
from __future__ import annotations

from typing import Any

from annotation.rep_segmenter import RepBoundary
from annotation.store import AnnotationStore


def batch_annotate(
    store: AnnotationStore,
    all_reps: dict[str, list[RepBoundary]],
    video_name: str,
    labels: list[dict[str, Any]],
) -> None:
    """Annotate multiple reps from a list of label dicts.

    Example label dicts:
        {'correct': True}
        {'correct': False, 'knee_valgus': True}
    """
    if video_name not in all_reps:
        print(f"No reps for '{video_name}'. Run segmentation first.")
        return

    reps = all_reps[video_name]
    num_to_annotate = min(len(labels), len(reps))

    for idx in range(num_to_annotate):
        start, end = reps[idx]
        label = labels[idx]
        store.annotate_rep(
            video_name=video_name,
            rep_index=idx,
            start_frame=start,
            end_frame=end,
            is_correct=label.get("correct", True),
            knee_valgus=label.get("knee_valgus", False),
            insufficient_depth=label.get("insufficient_depth", False),
            forward_lean=label.get("forward_lean", False),
            notes=label.get("notes", ""),
        )

    store.save()
    print(f"Batch annotated {num_to_annotate} reps for '{video_name}'.")
