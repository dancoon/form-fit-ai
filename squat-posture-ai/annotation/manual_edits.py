"""Manual rep boundary adjustments after automatic segmentation."""
from __future__ import annotations

from annotation.rep_segmenter import RepBoundary


def manually_add_rep(
    all_reps: dict[str, list[RepBoundary]],
    video_name: str,
    start_frame: int,
    end_frame: int,
) -> None:
    if video_name not in all_reps:
        all_reps[video_name] = []
    all_reps[video_name].append((start_frame, end_frame))
    all_reps[video_name].sort(key=lambda x: x[0])
    print(f"Added rep [{start_frame}:{end_frame}] to {video_name}")


def manually_remove_rep(
    all_reps: dict[str, list[RepBoundary]],
    video_name: str,
    rep_index: int,
) -> None:
    if video_name in all_reps and 0 <= rep_index < len(all_reps[video_name]):
        all_reps[video_name].pop(rep_index)
        print(f"Removed rep {rep_index} from {video_name}")


def adjust_rep_boundary(
    all_reps: dict[str, list[RepBoundary]],
    video_name: str,
    rep_index: int,
    new_start: int | None = None,
    new_end: int | None = None,
) -> None:
    if video_name not in all_reps or not (0 <= rep_index < len(all_reps[video_name])):
        return
    start, end = all_reps[video_name][rep_index]
    if new_start is not None:
        start = new_start
    if new_end is not None:
        end = new_end
    all_reps[video_name][rep_index] = (start, end)
    print(f"Adjusted rep {rep_index} in {video_name} to [{start}:{end}]")
