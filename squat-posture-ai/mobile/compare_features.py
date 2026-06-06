"""Compare 45x22 feature vectors from notebook vs app export.

Usage:
  python scripts/compare_features.py notebook_features.json app_features.json

Each JSON file: { "features": [[...22 floats], ...45 frames] }
"""

import json
import sys

EPS = 1e-3


def load(path: str) -> list[list[float]]:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data["features"]


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        raise SystemExit(1)

    a = load(sys.argv[1])
    b = load(sys.argv[2])

    if len(a) != len(b):
        print(f"Frame count mismatch: {len(a)} vs {len(b)}")
        raise SystemExit(1)

    max_diff = 0.0
    for i, (row_a, row_b) in enumerate(zip(a, b)):
        if len(row_a) != 22 or len(row_b) != 22:
            print(f"Frame {i}: expected 22 features")
            raise SystemExit(1)
        for j, (va, vb) in enumerate(zip(row_a, row_b)):
            d = abs(va - vb)
            max_diff = max(max_diff, d)
            if d > EPS:
                print(f"Mismatch frame {i} feat {j}: {va} vs {vb} (diff {d})")

    print(f"Max abs diff: {max_diff:.6f}")
    if max_diff <= EPS:
        print("PASS — features within tolerance")
    else:
        print(f"FAIL — tolerance {EPS}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
