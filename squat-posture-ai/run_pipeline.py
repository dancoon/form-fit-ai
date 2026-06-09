"""Run full training pipeline."""
from __future__ import annotations

import numpy as np
import tensorflow as tf

from evaluation.metrics import EvaluationPipeline
from models.architectures.factory import ModelFactory
from training.baselines import BaselineModels
from training.trainer import TrainingPipeline
from utils.config import Config
from utils.dataset_loader import prepare_training_splits


def main():
    cfg = Config()
    tf.random.set_seed(cfg.random_state)
    np.random.seed(cfg.random_state)
    print(f'Config: {cfg.num_engineered_features} features, seq={cfg.sequence_length}')

    splits, pipeline = prepare_training_splits(cfg)

    print(f"Train: {splits['X_train'].shape[0]} samples")
    print(f"Val:   {splits['X_val'].shape[0]} samples")
    print(f"Test:  {splits['X_test'].shape[0]} samples")
    print(f"Input shape: {splits['X_train'].shape[1:]}")

    scaler_path = pipeline.export_feature_scaler(f"{cfg.results_dir}/feature_scaler.json")
    print(f"Scaler exported → {scaler_path} (copy to app assets after retrain)")

    factory = ModelFactory(cfg)
    models = factory.get_all_models()
    trainer = TrainingPipeline(cfg)
    dl_results = trainer.train_all(models, splits)
    baselines = BaselineModels(cfg)
    baseline_results = baselines.train_and_evaluate(splits)
    evaluator = EvaluationPipeline(cfg)
    metrics = evaluator.evaluate_all(dl_results, baseline_results, splits)
    evaluator.print_comparison_table()
    print('Pipeline complete. Export BiGRU: python export_model.py --model BiGRU')
    return metrics


if __name__ == '__main__':
    main()
