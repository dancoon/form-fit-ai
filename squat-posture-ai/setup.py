from setuptools import find_packages, setup

setup(
    name="squat-posture-ai",
    version="0.1.0",
    packages=find_packages(
        include=[
            "utils",
            "utils.*",
            "models",
            "models.*",
            "training",
            "training.*",
            "inference",
            "inference.*",
            "evaluation",
            "evaluation.*",
            "mobile",
            "mobile.*",
            "annotation",
            "annotation.*",
        ]
    ),
    package_dir={"": "."},
    python_requires=">=3.10,<3.14",
    install_requires=[
        "tensorflow>=2.15.0,<2.20",
        "numpy>=1.26.0,<2.0",
        "pandas>=2.2.0",
        "opencv-python-headless>=4.10.0,<4.12",
        "mediapipe>=0.10.14,<0.11",
        "scikit-learn",
        "matplotlib",
        "seaborn",
        "xgboost",
        "tqdm",
        "tensorflow-model-optimization",
    ],
    entry_points={
        "console_scripts": [
            "squat-train=run_pipeline:main",
            "squat-annotate=run_annotation:main",
        ]
    },
)
