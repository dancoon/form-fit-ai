"""
Export StandardScaler params from the squat notebook for mobile inference.

Run in Colab (or locally) after `pipeline.normalize_features(splits)`:

    import json
    json.dump(
        {"mean": pipeline.scaler.mean_.tolist(), "scale": pipeline.scaler.scale_.tolist()},
        open("feature_scaler.json", "w"),
    )

Copy the file to mobile/src/assets/models/feature_scaler.json
"""
