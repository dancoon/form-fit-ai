"""Label definitions for the interactive annotation UI."""

LABEL_MAP: dict[str, dict] = {
    "c": {
        "label": "✓ Correct",
        "is_correct": True,
        "knee_valgus": False,
        "insufficient_depth": False,
        "forward_lean": False,
        "skip": False,
        "style": "success",
    },
    "k": {
        "label": "Knee valgus",
        "is_correct": False,
        "knee_valgus": True,
        "insufficient_depth": False,
        "forward_lean": False,
        "skip": False,
        "style": "warning",
    },
    "d": {
        "label": "Depth",
        "is_correct": False,
        "knee_valgus": False,
        "insufficient_depth": True,
        "forward_lean": False,
        "skip": False,
        "style": "warning",
    },
    "f": {
        "label": "Forward lean",
        "is_correct": False,
        "knee_valgus": False,
        "insufficient_depth": False,
        "forward_lean": True,
        "skip": False,
        "style": "warning",
    },
    "1": {
        "label": "K + F",
        "is_correct": False,
        "knee_valgus": True,
        "insufficient_depth": False,
        "forward_lean": True,
        "skip": False,
        "style": "warning",
    },
    "s": {
        "label": "Skip rep",
        "is_correct": False,
        "knee_valgus": False,
        "insufficient_depth": False,
        "forward_lean": False,
        "skip": True,
        "style": "danger",
    },
}

CHEATSHEET_HTML = """
<div style="
    font-family: monospace;
    background: #1e1e2e;
    color: #cdd6f4;
    border-radius: 8px;
    padding: 10px 16px;
    margin-bottom: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    font-size: 13px;
">
  <b style="color:#89b4fa;width:100%;margin-bottom:4px">⌨ Keyboard shortcuts</b>
  <span><kbd style="background:#313244;padding:2px 6px;border-radius:4px">C</kbd> Correct</span>
  <span><kbd style="background:#313244;padding:2px 6px;border-radius:4px">K</kbd> Knee valgus</span>
  <span><kbd style="background:#313244;padding:2px 6px;border-radius:4px">D</kbd> Depth</span>
  <span><kbd style="background:#313244;padding:2px 6px;border-radius:4px">F</kbd> Forward lean</span>
  <span><kbd style="background:#313244;padding:2px 6px;border-radius:4px">1</kbd> K+F</span>
  <span><kbd style="background:#313244;padding:2px 6px;border-radius:4px">S</kbd> Skip</span>
  <span><kbd style="background:#313244;padding:2px 6px;border-radius:4px">Space</kbd> / <kbd style="background:#313244;padding:2px 6px;border-radius:4px">→</kbd> Next rep</span>
</div>
"""

KEYBOARD_JS = """
<script>
(function() {
    if (window._sqAnnotatorKeyHandler) {
        document.removeEventListener('keydown', window._sqAnnotatorKeyHandler);
    }
    window._sqAnnotatorKeyHandler = function(e) {
        if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
        var key = e.key.toLowerCase();
        if (key === ' ' || key === 'arrowright') {
            e.preventDefault();
            var nextBtn = document.querySelector('[data-sq="next"]');
            if (nextBtn && !nextBtn.disabled) nextBtn.click();
            return;
        }
        var labelBtn = document.querySelector('[data-sq="label-' + key + '"]');
        if (labelBtn && !labelBtn.disabled) {
            e.preventDefault();
            labelBtn.click();
        }
    };
    document.addEventListener('keydown', window._sqAnnotatorKeyHandler);
})();
</script>
"""
