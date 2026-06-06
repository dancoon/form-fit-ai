from __future__ import annotations

from typing import Dict

import numpy as np
import pandas as pd
from tensorflow.keras import Model

def plot_size_vs_performance(tflite_df: pd.DataFrame, results_df: pd.DataFrame):
    """Plot model size vs performance for mobile deployment decision."""
    if tflite_df.empty:
        print("No TFLite results to plot.")
        return

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    # Size vs FPS
    non_quantized = tflite_df[~tflite_df['quantized']].copy()
    if not non_quantized.empty:
        ax = axes[0]
        ax.scatter(non_quantized['size_mb'], non_quantized['fps'],
                   s=100, c='steelblue', alpha=0.8)
        for _, row in non_quantized.iterrows():
            ax.annotate(row['model_name'], (row['size_mb'], row['fps']),
                        fontsize=8, ha='left')
        ax.set_xlabel('Model Size (MB)')
        ax.set_ylabel('FPS')
        ax.set_title('Model Size vs Inference Speed')
        ax.axhline(y=30, color='r', linestyle='--', alpha=0.5, label='30 FPS target')
        ax.legend()
        ax.grid(True, alpha=0.3)

    # Standard vs Quantized size comparison
    ax = axes[1]
    model_names = tflite_df[~tflite_df['quantized']]['model_name'].values
    std_sizes = tflite_df[~tflite_df['quantized']]['size_mb'].values
    q_names = tflite_df[tflite_df['quantized']]['model_name'].values
    q_sizes = tflite_df[tflite_df['quantized']]['size_mb'].values

    x = np.arange(min(len(std_sizes), len(q_sizes)))
    width = 0.35
    ax.bar(x - width/2, std_sizes[:len(x)], width, label='Standard', color='steelblue')
    ax.bar(x + width/2, q_sizes[:len(x)], width, label='Quantized', color='coral')
    ax.set_xlabel('Model')
    ax.set_ylabel('Size (MB)')
    ax.set_title('Standard vs Quantized Model Size')
    ax.set_xticks(x)
    ax.set_xticklabels(model_names[:len(x)], rotation=45, ha='right', fontsize=8)
    ax.legend()
    ax.grid(True, alpha=0.3, axis='y')

    plt.tight_layout()
    plt.savefig(f'{cfg.results_dir}/size_vs_performance.png', dpi=150, bbox_inches='tight')
    plt.show()


plot_size_vs_performance(tflite_df, results_df)

def assess_mobile_suitability(results_df: pd.DataFrame,
                              tflite_df: pd.DataFrame) -> pd.DataFrame:
    """Score models on mobile deployment suitability."""
    scores = []

    for _, row in results_df.iterrows():
        name = row['model_name']
        score = 0
        reasons = []

        # Accuracy (max 30 points)
        acc = float(row['accuracy']) if isinstance(row['accuracy'], (int, float)) else 0
        acc_score = min(30, int(acc * 30))
        score += acc_score

        # Latency (max 30 points, lower is better)
        latency = float(row['inference_latency_ms']) if isinstance(row['inference_latency_ms'], (int, float)) else 100
        if latency < 10:
            lat_score = 30
        elif latency < 33:
            lat_score = 25
        elif latency < 50:
            lat_score = 15
        else:
            lat_score = 5
        score += lat_score

        # TFLite conversion (20 points)
        tflite_success = name in tflite_df['model_name'].values if not tflite_df.empty else False
        if tflite_success:
            score += 20
            reasons.append("TFLite OK")
        else:
            reasons.append("No TFLite")

        # Model size (max 20 points)
        if not tflite_df.empty:
            tflite_row = tflite_df[tflite_df['model_name'] == name]
            if not tflite_row.empty:
                size = tflite_row.iloc[0]['size_mb']
                if size < 1:
                    score += 20
                elif size < 5:
                    score += 15
                elif size < 10:
                    score += 10
                else:
                    score += 5

        suitability = "Excellent" if score >= 80 else "Good" if score >= 60 else "Moderate" if score >= 40 else "Low"

        scores.append({
            'model_name': name,
            'mobile_score': score,
            'suitability': suitability,
            'acc_score': acc_score,
            'latency_score': lat_score,
        })

    df = pd.DataFrame(scores).sort_values('mobile_score', ascending=False)
    print("\nMobile Deployment Suitability Ranking:")
    print("=" * 60)
    print(df[['model_name', 'mobile_score', 'suitability']].to_string(index=False))
    return df


mobile_scores = assess_mobile_suitability(results_df, tflite_df)
