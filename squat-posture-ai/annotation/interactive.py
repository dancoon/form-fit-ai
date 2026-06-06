"""Jupyter widget UI for visual rep annotation."""
from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

import cv2
import ipywidgets as widgets
import matplotlib.pyplot as plt
from IPython.display import HTML as IHTML
from IPython.display import clear_output, display

from annotation.labels import CHEATSHEET_HTML, KEYBOARD_JS, LABEL_MAP
from annotation.rep_segmenter import RepBoundary
from annotation.store import AnnotationStore


def show_rep_frames(
    video_path: str | Path,
    start_frame: int,
    end_frame: int,
    num_display: int = 8,
) -> None:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"Cannot open: {video_path}")
        return

    total = end_frame - start_frame
    step = max(1, total // num_display)
    indices = list(range(start_frame, end_frame, step))[:num_display]

    fig, axes = plt.subplots(1, len(indices), figsize=(3 * len(indices), 4))
    if len(indices) == 1:
        axes = [axes]

    for ax_idx, fi in enumerate(indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
        ret, frame = cap.read()
        if ret:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            axes[ax_idx].imshow(frame_rgb)
            axes[ax_idx].set_title(f"Frame {fi}", fontsize=9)
        axes[ax_idx].axis("off")

    cap.release()
    plt.tight_layout()
    plt.show()


def annotate_interactively(
    store: AnnotationStore,
    video_name: str,
    video_path: str | Path,
    reps: list[RepBoundary],
    on_complete: Callable[[], None] | None = None,
) -> None:
    """Widget-based annotation with keyboard shortcuts (C/K/D/F/1/S, Space/→)."""
    state = {"idx": 0, "ready_for_next": False}

    out = widgets.Output()
    status = widgets.HTML(value="")
    counter = widgets.HTML()
    feedback = widgets.HTML(value="")
    progress_html = widgets.HTML()
    cheatsheet = widgets.HTML(value=CHEATSHEET_HTML)
    js_widget = IHTML(KEYBOARD_JS)

    def _make_label_btn(key: str, meta: dict) -> widgets.Button:
        btn = widgets.Button(
            description=f"[{key.upper()}] {meta['label']}",
            button_style=meta["style"],
            layout=widgets.Layout(width="160px"),
        )
        btn._sq_key = key  # type: ignore[attr-defined]
        return btn

    label_btns = {key: _make_label_btn(key, meta) for key, meta in LABEL_MAP.items()}
    next_btn = widgets.Button(
        description="[Space/→] Next rep",
        button_style="info",
        disabled=True,
        layout=widgets.Layout(width="180px"),
    )

    attr_js = "".join(
        f"""<script>
        (function(){{
            var btns = document.querySelectorAll('.widget-button');
            btns.forEach(function(b){{
                if(b.textContent.trim().startsWith('[{key.upper()}]'))
                    b.setAttribute('data-sq','label-{key}');
                if(b.textContent.trim().startsWith('[Space'))
                    b.setAttribute('data-sq','next');
            }});
        }})();
        </script>"""
        for key in LABEL_MAP
    )
    attr_injector = IHTML(attr_js)

    def first_unannotated() -> int | None:
        for j in range(len(reps)):
            if not store.is_rep_annotated(video_name, j):
                return j
        return None

    def update_progress_header() -> None:
        prog = store.get_video_progress(video_name, len(reps))
        progress_html.value = (
            f'<div style="font-size:0.95em;color:#555">'
            f"Video progress: {prog['annotated']}/{prog['total']} "
            f"({prog['progress_pct']:.0f}%)"
            f"</div>"
        )

    def refresh_grid() -> None:
        grid.value = " ".join(_grid_symbol(i) for i in range(len(reps)))

    def set_label_buttons_enabled(enabled: bool) -> None:
        for btn in label_btns.values():
            btn.disabled = not enabled

    def _grid_symbol(i: int) -> str:
        if i == state["idx"]:
            return "▶"
        ann = store.get_rep_annotation(video_name, i)
        if ann is None:
            return "○"
        return "✓" if ann["is_correct"] else "!"

    grid = widgets.HTML()

    def show_rep() -> None:
        i = state["idx"]
        start, end = reps[i]
        ann = store.get_rep_annotation(video_name, i)
        already_done = ann is not None

        state["ready_for_next"] = already_done
        next_btn.disabled = not already_done
        set_label_buttons_enabled(not already_done)

        counter.value = (
            f"<b>Rep {i + 1}/{len(reps)}</b> &nbsp;"
            f'<span style="color:gray">frames {start}–{end}</span>'
        )

        if already_done:
            summary = store.label_summary(ann)
            feedback.value = (
                f'<div style="font-size:1.1em">'
                f'<span style="color:#2e7d32"><b>Already annotated:</b> {summary}</span>'
                f"</div>"
            )
            status.value = (
                '<span style="color:gray">Locked. Press <b>Space</b> or <b>→</b> to continue.</span>'
            )
        else:
            feedback.value = (
                '<span style="color:#1565c0"><b>Step 1:</b> Press a key to label this rep.</span>'
            )
            status.value = '<span style="color:gray">You must label before advancing.</span>'

        refresh_grid()
        update_progress_header()

        with out:
            clear_output(wait=True)
            show_rep_frames(video_path, start, end)

    def on_label(btn: widgets.Button) -> None:
        i = state["idx"]
        if store.is_rep_annotated(video_name, i):
            status.value = '<span style="color:orange">Already annotated — cannot change.</span>'
            return

        key = btn._sq_key  # type: ignore[attr-defined]
        meta = LABEL_MAP[key]
        start, end = reps[i]

        if not meta["skip"]:
            store.annotate_rep(
                video_name=video_name,
                rep_index=i,
                start_frame=start,
                end_frame=end,
                is_correct=meta["is_correct"],
                knee_valgus=meta["knee_valgus"],
                insufficient_depth=meta["insufficient_depth"],
                forward_lean=meta["forward_lean"],
            )
            store.save()
            ann = store.get_rep_annotation(video_name, i)
            summary = store.label_summary(ann)
            feedback.value = (
                f'<div style="font-size:1.15em;padding:8px;background:#e8f5e9;border-radius:6px">'
                f"<b>✓ Saved rep {i + 1}:</b> {summary}"
                f"</div>"
            )
        else:
            feedback.value = (
                f'<div style="font-size:1.15em;padding:8px;background:#fff3e0;border-radius:6px">'
                f"<b>Rep {i + 1} skipped</b> (not saved to dataset)"
                f"</div>"
            )

        state["ready_for_next"] = True
        set_label_buttons_enabled(False)
        next_btn.disabled = False
        status.value = '<span style="color:#2e7d32"><b>Step 2:</b> Press <b>Space</b> or <b>→</b> for next rep.</span>'
        refresh_grid()
        update_progress_header()

    def on_next(_: widgets.Button) -> None:
        i = state["idx"]
        if not state["ready_for_next"] and not store.is_rep_annotated(video_name, i):
            feedback.value = (
                '<span style="color:#c62828"><b>Pick a label first</b> — use a key shortcut below.</span>'
            )
            return

        nxt = None
        for j in range(i + 1, len(reps)):
            if not store.is_rep_annotated(video_name, j):
                nxt = j
                break
        if nxt is None:
            nxt = first_unannotated()

        if nxt is None or nxt == i:
            with out:
                clear_output(wait=True)
                print(f"✅ Done — all reps handled for {video_name}.")
            set_label_buttons_enabled(False)
            next_btn.disabled = True
            feedback.value = (
                f'<span style="color:#2e7d32"><b>All {len(reps)} reps complete for this video.</b></span>'
            )
            status.value = ""
            refresh_grid()
            update_progress_header()
            if on_complete is not None:
                on_complete()
            return

        state["idx"] = nxt
        show_rep()

    for btn in label_btns.values():
        btn.on_click(on_label)
    next_btn.on_click(on_next)

    start_idx = first_unannotated() or 0
    state["idx"] = start_idx

    display(
        widgets.VBox(
            [
                cheatsheet,
                js_widget,
                attr_injector,
                progress_html,
                counter,
                grid,
                feedback,
                status,
                widgets.HBox(list(label_btns.values())),
                next_btn,
                out,
            ]
        )
    )
    show_rep()


def build_pending_video_list(
    video_dir: Path,
    extracted_data: dict,
    all_reps: dict[str, list[RepBoundary]],
    store: AnnotationStore,
) -> list[tuple[str, str, list[RepBoundary]]]:
    pending = []
    for video_name in extracted_data:
        if video_name not in all_reps or not all_reps[video_name]:
            continue
        reps = all_reps[video_name]
        progress = store.get_video_progress(video_name, len(reps))
        if progress["remaining"] > 0:
            video_path = video_dir / f"{video_name}.mp4"
            for f in video_dir.iterdir():
                if f.stem == video_name:
                    video_path = f
                    break
            pending.append((video_name, str(video_path), reps))
        else:
            print(f"  ✅ Skipping '{video_name}' — all {len(reps)} reps already annotated")
    return pending


def run_annotation_session(
    store: AnnotationStore,
    videos: list[tuple[str, str, list[RepBoundary]]],
) -> None:
    videos = list(videos)
    session_out = widgets.Output()
    display(session_out)

    def show_next(remaining: list[tuple[str, str, list[RepBoundary]]]) -> None:
        if not remaining:
            with session_out:
                clear_output(wait=True)
                print("✅ All videos annotated!")
            return

        video_name, video_path, reps = remaining[0]

        with session_out:
            clear_output(wait=True)
            annotate_interactively(
                store=store,
                video_name=video_name,
                video_path=video_path,
                reps=reps,
                on_complete=lambda: show_next(remaining[1:]),
            )

    show_next(videos)
