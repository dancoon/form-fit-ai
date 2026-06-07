from __future__ import annotations

from typing import Dict, List
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from tensorflow.keras import Model

from utils.config import Config
class EvaluationPipeline:
    """Comprehensive evaluation for all models."""

    def __init__(self, config: Config):
        self.cfg = config
        self.results_df = None

    def evaluate_dl_model(self, model: Model, splits: Dict,
                          model_name: str) -> Dict:
        """Full evaluation of a deep learning model."""
        X_test = splits['X_test']
        y_test = splits['y_test']
        ye_test = splits['ye_test']

        predictions = model.predict(X_test, verbose=0)
        cls_probs = predictions[0].flatten()
        err_probs = predictions[1]

        cls_preds = (cls_probs >= 0.5).astype(int)
        err_preds = (err_probs >= 0.5).astype(int)

        metrics = {
            'model_name': model_name,
            'accuracy': accuracy_score(y_test, cls_preds),
            'precision': precision_score(y_test, cls_preds, average='weighted'),
            'recall': recall_score(y_test, cls_preds, average='weighted'),
            'f1': f1_score(y_test, cls_preds, average='weighted'),
            'roc_auc': roc_auc_score(y_test, cls_probs),
            'cls_preds': cls_preds,
            'cls_probs': cls_probs,
            'err_preds': err_preds,
            'err_probs': err_probs,
        }

        # Per-error-type metrics
        error_names = ['knee_valgus', 'insufficient_depth', 'forward_lean']
        for i, ename in enumerate(error_names):
            if ye_test[:, i].sum() > 0:
                metrics[f'{ename}_f1'] = f1_score(ye_test[:, i], err_preds[:, i])
                metrics[f'{ename}_auc'] = roc_auc_score(ye_test[:, i], err_probs[:, i])
            else:
                metrics[f'{ename}_f1'] = 0.0
                metrics[f'{ename}_auc'] = 0.0

        return metrics

    def evaluate_all(self, dl_results: Dict, baseline_results: Dict,
                     splits: Dict) -> pd.DataFrame:
        """Evaluate all models and create comparison dataframe."""
        all_metrics = []

        # Deep learning models
        for name, result in dl_results.items():
            model = result['model']
            metrics = self.evaluate_dl_model(model, splits, name)
            metrics['params'] = result['params']
            metrics['train_time'] = result['train_time']
            metrics['inference_latency_ms'] = result['inference_latency_ms']
            metrics['type'] = 'Deep Learning'
            all_metrics.append(metrics)

        # Baseline models
        for name, result in baseline_results.items():
            metrics = {
                'model_name': name,
                'accuracy': result['accuracy'],
                'precision': result['precision'],
                'recall': result['recall'],
                'f1': result['f1'],
                'roc_auc': result['roc_auc'],
                'params': result['params'],
                'train_time': result['train_time'],
                'inference_latency_ms': result['inference_latency_ms'],
                'type': 'ML Baseline',
                'cls_preds': result['y_pred'],
                'cls_probs': result['y_prob'],
            }
            all_metrics.append(metrics)

        # Create summary dataframe
        summary_cols = ['model_name', 'type', 'accuracy', 'precision', 'recall',
                        'f1', 'roc_auc', 'params', 'train_time', 'inference_latency_ms']
        rows = []
        for m in all_metrics:
            row = {col: m.get(col, 'N/A') for col in summary_cols}
            rows.append(row)

        self.results_df = pd.DataFrame(rows)
        self.all_metrics = all_metrics

        return self.results_df

    def print_comparison_table(self):
        """Print publication-quality comparison table."""
        df = self.results_df.copy()
        df['accuracy'] = df['accuracy'].apply(lambda x: f"{x:.4f}" if isinstance(x, float) else x)
        df['f1'] = df['f1'].apply(lambda x: f"{x:.4f}" if isinstance(x, float) else x)
        df['roc_auc'] = df['roc_auc'].apply(lambda x: f"{x:.4f}" if isinstance(x, float) else x)
        df['inference_latency_ms'] = df['inference_latency_ms'].apply(
            lambda x: f"{x:.2f}" if isinstance(x, float) else x
        )
        print("\n" + "="*100)
        print("MODEL COMPARISON RESULTS")
        print("="*100)
        print(df.to_string(index=False))
        print("="*100)
