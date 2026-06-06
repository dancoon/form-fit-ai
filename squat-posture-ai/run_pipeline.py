"""Run full training pipeline."""
from __future__ import annotations

import numpy as np
import tensorflow as tf

from evaluation.metrics import EvaluationPipeline
from models.architectures.factory import ModelFactory
from training.baselines import BaselineModels
from training.trainer import TrainingPipeline
from utils.config import Config
from utils.data_generator import SquatDataGenerator
from utils.data_pipeline import DataPipeline
from utils.biomechanics import BiomechanicsEngine

def main():
    cfg = Config()
    tf.random.set_seed(cfg.random_state)
    np.random.seed(cfg.random_state)
    print(f'Config: {cfg.num_engineered_features} features, seq={cfg.sequence_length}')
    gen = SquatDataGenerator(cfg)
    raw_X, y_cls, y_err = gen.generate_dataset()
    biomech = BiomechanicsEngine()
    X = np.array([biomech.extract_sequence_features(seq) for seq in raw_X])
    pipeline = DataPipeline(cfg)
    splits = pipeline.split_data(X, y_cls, y_err)
    splits = pipeline.normalize_sequences(splits)
    factory = ModelFactory(cfg)
    models = factory.get_all_models()
    trainer = TrainingPipeline(cfg)
    dl_results = trainer.train_all(models, splits)
    baselines = BaselineModels(cfg)
    baseline_results = baselines.train_and_evaluate(splits)
    evaluator = EvaluationPipeline(cfg)
    metrics = evaluator.evaluate_all(dl_results, baseline_results, splits)
    evaluator.print_comparison_table()
    print('Pipeline complete. Export TFLite via mobile/tflite_converter.py')
    return metrics

if __name__ == '__main__':
    main()
