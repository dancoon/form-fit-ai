from __future__ import annotations

from typing import Dict, List

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import precision_recall_curve, roc_curve

from utils.config import Config
class VisualizationPipeline:
    """Publication-quality visualization of all results."""

    def __init__(self, config: Config):
        self.cfg = config
        self.colors = sns.color_palette('husl', 13)

    def plot_training_curves(self, histories: Dict[str, Dict]):
        """Plot training/validation curves for all models."""
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))

        for i, (name, history) in enumerate(histories.items()):
            color = self.colors[i % len(self.colors)]

            if 'classification_accuracy' in history:
                axes[0, 0].plot(history['classification_accuracy'],
                               color=color, alpha=0.7, label=name)
                axes[0, 1].plot(history['val_classification_accuracy'],
                               color=color, alpha=0.7, label=name)
                axes[1, 0].plot(history['loss'],
                               color=color, alpha=0.7, label=name)
                axes[1, 1].plot(history['val_loss'],
                               color=color, alpha=0.7, label=name)

        axes[0, 0].set_title('Training Accuracy')
        axes[0, 1].set_title('Validation Accuracy')
        axes[1, 0].set_title('Training Loss')
        axes[1, 1].set_title('Validation Loss')

        for ax in axes.flat:
            ax.legend(fontsize=8, loc='best')
            ax.set_xlabel('Epoch')
            ax.grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig(f'{self.cfg.results_dir}/training_curves.png', dpi=150, bbox_inches='tight')
        plt.show()

    def plot_confusion_matrices(self, all_metrics: List[Dict],
                                y_test: np.ndarray):
        """Plot confusion matrices for top models."""
        # Select top 6 models by F1
        sorted_metrics = sorted(
            [m for m in all_metrics if 'cls_preds' in m],
            key=lambda x: x.get('f1', 0), reverse=True
        )[:6]

        fig, axes = plt.subplots(2, 3, figsize=(15, 10))
        axes = axes.flatten()

        for i, metrics in enumerate(sorted_metrics):
            cm = confusion_matrix(y_test, metrics['cls_preds'])
            sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                        ax=axes[i], cbar=False,
                        xticklabels=['Correct', 'Incorrect'],
                        yticklabels=['Correct', 'Incorrect'])
            axes[i].set_title(f"{metrics['model_name']}\nF1={metrics['f1']:.4f}")
            axes[i].set_ylabel('True')
            axes[i].set_xlabel('Predicted')

        plt.tight_layout()
        plt.savefig(f'{self.cfg.results_dir}/confusion_matrices.png', dpi=150, bbox_inches='tight')
        plt.show()

    def plot_roc_curves(self, all_metrics: List[Dict], y_test: np.ndarray):
        """Plot ROC curves for all models."""
        fig, ax = plt.subplots(1, 1, figsize=(10, 8))

        for i, metrics in enumerate(all_metrics):
            if 'cls_probs' in metrics:
                fpr, tpr, _ = roc_curve(y_test, metrics['cls_probs'])
                auc_val = metrics.get('roc_auc', 0)
                ax.plot(fpr, tpr, color=self.colors[i % len(self.colors)],
                        label=f"{metrics['model_name']} (AUC={auc_val:.4f})")

        ax.plot([0, 1], [0, 1], 'k--', alpha=0.5)
        ax.set_xlabel('False Positive Rate')
        ax.set_ylabel('True Positive Rate')
        ax.set_title('ROC Curves - All Models')
        ax.legend(fontsize=9, loc='lower right')
        ax.grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig(f'{self.cfg.results_dir}/roc_curves.png', dpi=150, bbox_inches='tight')
        plt.show()

    def plot_precision_recall_curves(self, all_metrics: List[Dict],
                                    y_test: np.ndarray):
        """Plot precision-recall curves."""
        fig, ax = plt.subplots(1, 1, figsize=(10, 8))

        for i, metrics in enumerate(all_metrics):
            if 'cls_probs' in metrics:
                precision, recall, _ = precision_recall_curve(y_test, metrics['cls_probs'])
                ap = average_precision_score(y_test, metrics['cls_probs'])
                ax.plot(recall, precision, color=self.colors[i % len(self.colors)],
                        label=f"{metrics['model_name']} (AP={ap:.4f})")

        ax.set_xlabel('Recall')
        ax.set_ylabel('Precision')
        ax.set_title('Precision-Recall Curves')
        ax.legend(fontsize=9, loc='best')
        ax.grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig(f'{self.cfg.results_dir}/pr_curves.png', dpi=150, bbox_inches='tight')
        plt.show()

    def plot_model_comparison_bars(self, results_df: pd.DataFrame):
        """Bar chart comparing key metrics across models."""
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))

        metrics_to_plot = [
            ('accuracy', 'Accuracy', axes[0, 0]),
            ('f1', 'F1-Score', axes[0, 1]),
            ('roc_auc', 'ROC-AUC', axes[1, 0]),
            ('inference_latency_ms', 'Inference Latency (ms)', axes[1, 1]),
        ]

        for metric, title, ax in metrics_to_plot:
            data = results_df[['model_name', metric]].copy()
            data[metric] = pd.to_numeric(data[metric], errors='coerce')
            data = data.dropna()
            data = data.sort_values(metric, ascending=(metric == 'inference_latency_ms'))

            bars = ax.barh(data['model_name'], data[metric],
                           color=self.colors[:len(data)])
            ax.set_title(title)
            ax.set_xlabel(metric)

        plt.tight_layout()
        plt.savefig(f'{self.cfg.results_dir}/model_comparison.png', dpi=150, bbox_inches='tight')
        plt.show()

    def plot_latency_vs_accuracy(self, results_df: pd.DataFrame):
        """Scatter plot of latency vs accuracy (Pareto frontier)."""
        fig, ax = plt.subplots(1, 1, figsize=(10, 8))

        df = results_df.copy()
        df['accuracy'] = pd.to_numeric(df['accuracy'], errors='coerce')
        df['inference_latency_ms'] = pd.to_numeric(df['inference_latency_ms'], errors='coerce')
        df = df.dropna(subset=['accuracy', 'inference_latency_ms'])

        for i, row in df.iterrows():
            ax.scatter(row['inference_latency_ms'], row['accuracy'],
                       s=100, color=self.colors[i % len(self.colors)], zorder=5)
            ax.annotate(row['model_name'], (row['inference_latency_ms'], row['accuracy']),
                        fontsize=8, ha='left', va='bottom')

        ax.set_xlabel('Inference Latency (ms)')
        ax.set_ylabel('Accuracy')
        ax.set_title('Latency vs Accuracy Trade-off')
        ax.grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig(f'{self.cfg.results_dir}/latency_vs_accuracy.png', dpi=150, bbox_inches='tight')
        plt.show()

    def plot_error_distribution(self, all_metrics: List[Dict]):
        """Plot per-error-type detection performance."""
        error_names = ['knee_valgus', 'insufficient_depth', 'forward_lean']
        dl_metrics = [m for m in all_metrics if f'{error_names[0]}_f1' in m]

        if not dl_metrics:
            return

        fig, ax = plt.subplots(1, 1, figsize=(12, 6))

        model_names = [m['model_name'] for m in dl_metrics]
        x = np.arange(len(model_names))
        width = 0.25

        for j, ename in enumerate(error_names):
            f1_scores = [m.get(f'{ename}_f1', 0) for m in dl_metrics]
            ax.bar(x + j * width, f1_scores, width, label=ename.replace('_', ' ').title())

        ax.set_xlabel('Model')
        ax.set_ylabel('F1-Score')
        ax.set_title('Per-Error-Type Detection F1-Score')
        ax.set_xticks(x + width)
        ax.set_xticklabels(model_names, rotation=45, ha='right')
        ax.legend()
        ax.grid(True, alpha=0.3, axis='y')

        plt.tight_layout()
        plt.savefig(f'{self.cfg.results_dir}/error_distribution.png', dpi=150, bbox_inches='tight')
        plt.show()

    def run_all(self, histories: Dict, all_metrics: List[Dict],
               results_df: pd.DataFrame, y_test: np.ndarray):
        """Generate all visualizations."""
        print("Generating visualizations...")
        self.plot_training_curves(histories)
        self.plot_confusion_matrices(all_metrics, y_test)
        self.plot_roc_curves(all_metrics, y_test)
        self.plot_precision_recall_curves(all_metrics, y_test)
        self.plot_model_comparison_bars(results_df)
        self.plot_latency_vs_accuracy(results_df)
        self.plot_error_distribution(all_metrics)
        print("All visualizations saved.")


viz = VisualizationPipeline(cfg)
viz.run_all(trainer.histories, evaluator.all_metrics, results_df, splits['y_test'])
