from __future__ import annotations

from typing import Optional, Tuple

import numpy as np

from utils.augmentation import augment_raw_sequence
from utils.config import Config, LM
class SquatDataGenerator:
    """Generates synthetic squat pose data with realistic biomechanics."""

    def __init__(self, config: Config):
        self.cfg = config
        self.rng = np.random.default_rng(config.random_state)

    def _generate_standing_pose(self) -> np.ndarray:
        """Generate a neutral standing pose."""
        pose = np.zeros(self.cfg.raw_feature_dim, dtype=np.float32)

        base_positions = {
            LM.NOSE: [0.5, 0.15, 0.0],
            LM.LEFT_SHOULDER: [0.55, 0.28, 0.0],
            LM.RIGHT_SHOULDER: [0.45, 0.28, 0.0],
            LM.LEFT_HIP: [0.54, 0.52, 0.0],
            LM.RIGHT_HIP: [0.46, 0.52, 0.0],
            LM.LEFT_KNEE: [0.55, 0.72, 0.0],
            LM.RIGHT_KNEE: [0.45, 0.72, 0.0],
            LM.LEFT_ANKLE: [0.55, 0.92, 0.0],
            LM.RIGHT_ANKLE: [0.45, 0.92, 0.0],
            LM.LEFT_HEEL: [0.56, 0.94, 0.01],
            LM.RIGHT_HEEL: [0.44, 0.94, 0.01],
            LM.LEFT_FOOT_INDEX: [0.54, 0.95, -0.02],
            LM.RIGHT_FOOT_INDEX: [0.46, 0.95, -0.02],
            LM.LEFT_EAR: [0.53, 0.12, 0.0],
            LM.RIGHT_EAR: [0.47, 0.12, 0.0],
        }

        for lm_idx, coords in base_positions.items():
            start = lm_idx * 4
            pose[start:start+3] = coords
            pose[start+3] = 0.95 + self.rng.uniform(-0.03, 0.03)

        # Fill remaining landmarks with reasonable defaults
        for i in range(33):
            if pose[i*4+3] == 0:  # visibility not set
                pose[i*4] = 0.5 + self.rng.uniform(-0.1, 0.1)
                pose[i*4+1] = 0.3 + self.rng.uniform(-0.1, 0.1)
                pose[i*4+2] = self.rng.uniform(-0.05, 0.05)
                pose[i*4+3] = 0.9

        return pose

    def _apply_squat_motion(self, standing_pose: np.ndarray,
                            depth_factor: float) -> np.ndarray:
        """Apply squat motion to standing pose. depth_factor: 0=standing, 1=full squat."""
        pose = standing_pose.copy()

        # Hips descend
        hip_descent = depth_factor * 0.25
        for hip_idx in [LM.LEFT_HIP, LM.RIGHT_HIP]:
            pose[hip_idx*4+1] += hip_descent

        # Knees flex forward and down
        knee_forward = depth_factor * 0.06
        knee_descent = depth_factor * 0.1
        for knee_idx in [LM.LEFT_KNEE, LM.RIGHT_KNEE]:
            pose[knee_idx*4+1] += knee_descent
            pose[knee_idx*4+2] -= knee_forward

        # Torso slight forward lean
        torso_lean = depth_factor * 0.03
        for idx in [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.NOSE]:
            pose[idx*4+1] += hip_descent * 0.5
            pose[idx*4+2] -= torso_lean

        return pose

    def _inject_knee_valgus(self, pose: np.ndarray, severity: float) -> np.ndarray:
        """Inject knee valgus (knees caving inward)."""
        pose = pose.copy()
        inward_shift = severity * 0.06
        pose[LM.LEFT_KNEE*4] -= inward_shift   # left knee moves right
        pose[LM.RIGHT_KNEE*4] += inward_shift  # right knee moves left
        return pose

    def _inject_insufficient_depth(self, depth_factor: float) -> float:
        """Reduce squat depth to simulate insufficient depth."""
        return depth_factor * self.rng.uniform(0.3, 0.55)

    def _inject_forward_lean(self, pose: np.ndarray, severity: float) -> np.ndarray:
        """Inject excessive forward lean."""
        pose = pose.copy()
        lean = severity * 0.12
        for idx in [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.NOSE,
                    LM.LEFT_EAR, LM.RIGHT_EAR]:
            pose[idx*4+2] -= lean
            pose[idx*4+1] += lean * 0.3
        return pose

    def _depth_curve(self, seq_length: int) -> np.ndarray:
        """Standing → descend → ascend → standing (matches on-device rep resampling)."""
        hold = max(4, seq_length // 9)
        active = max(8, seq_length - 2 * hold)
        t = np.linspace(0, np.pi, active)
        curve = np.zeros(seq_length, dtype=np.float32)
        curve[hold:hold + active] = np.sin(t)
        return curve

    def _augment_raw_sequence(self, sequence: np.ndarray) -> np.ndarray:
        """Pose-space augmentation before feature extraction."""
        mirror = self.rng.random() < self.cfg.mirror_augment_prob
        return augment_raw_sequence(
            sequence,
            self.cfg,
            self.rng,
            mirror=mirror,
            jitter=True,
            time_warp=False,
        )

    def generate_squat_sequence(self, error_type: Optional[str] = None,
                                seq_length: Optional[int] = None,
                                *, depth_scale: float = 1.0) -> Tuple[np.ndarray, int, np.ndarray]:
        """Generate a complete squat rep sequence.

        Returns: (sequence, label, error_vector)
        """
        seq_length = seq_length or self.cfg.sequence_length

        standing = self._generate_standing_pose()
        noise_scale = self.cfg.pose_noise_scale

        depth_curve = self._depth_curve(seq_length) * depth_scale

        # Error configuration
        error_vector = np.zeros(self.cfg.num_error_types, dtype=np.float32)
        label = 0  # correct

        if error_type == 'knee_valgus':
            error_vector[0] = 1.0
            label = 1
            severity = self.rng.uniform(0.5, 1.0)
        elif error_type == 'insufficient_depth':
            error_vector[1] = 1.0
            label = 1
            depth_curve *= self.rng.uniform(0.22, 0.48)
        elif error_type == 'forward_lean':
            error_vector[2] = 1.0
            label = 1
            severity = self.rng.uniform(0.5, 1.0)
        elif error_type == 'multiple':
            # Randomly combine 2 errors
            errors_to_apply = self.rng.choice(['knee_valgus', 'forward_lean', 'insufficient_depth'],
                                             size=2, replace=False)
            for e in errors_to_apply:
                if e == 'knee_valgus':
                    error_vector[0] = 1.0
                elif e == 'insufficient_depth':
                    error_vector[1] = 1.0
                    depth_curve *= self.rng.uniform(0.35, 0.55)
                elif e == 'forward_lean':
                    error_vector[2] = 1.0
            label = 1
            severity = self.rng.uniform(0.5, 1.0)

        # Generate sequence frame-by-frame
        sequence = np.zeros((seq_length, self.cfg.raw_feature_dim), dtype=np.float32)

        for i in range(seq_length):
            depth = depth_curve[i]
            frame = self._apply_squat_motion(standing, depth)

            if error_type == 'knee_valgus' or \
               (error_type == 'multiple' and error_vector[0] == 1.0):
                frame = self._inject_knee_valgus(frame, severity * depth)

            if error_type == 'forward_lean' or \
               (error_type == 'multiple' and error_vector[2] == 1.0):
                frame = self._inject_forward_lean(frame, severity * depth)

            # Add realistic noise
            noise = self.rng.normal(0, noise_scale, frame.shape)
            noise[3::4] = 0  # Don't add noise to visibility
            frame += noise

            sequence[i] = frame

        return self._augment_raw_sequence(sequence), label, error_vector

    def generate_dataset(self) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Generate full dataset with balanced classes + hard negatives."""
        sequences = []
        labels = []
        error_vectors = []

        base = self.cfg.num_samples
        hard_n = int(base * self.cfg.hard_negative_fraction)
        core_n = base - hard_n
        samples_per_class = core_n // 5

        error_configs = [
            (None, samples_per_class),
            ('knee_valgus', samples_per_class),
            ('insufficient_depth', samples_per_class),
            ('forward_lean', samples_per_class),
            ('multiple', samples_per_class),
        ]

        for error_type, count in error_configs:
            for _ in range(count):
                depth_scale = 1.0
                if error_type is None:
                    depth_scale = self.rng.uniform(0.88, 1.0)
                seq, lbl, err_vec = self.generate_squat_sequence(
                    error_type=error_type,
                    depth_scale=depth_scale,
                )
                sequences.append(seq)
                labels.append(lbl)
                error_vectors.append(err_vec)

        # Hard negatives: shallow but labeled incorrect (reduces false "go deeper" on device)
        for _ in range(hard_n // 2):
            seq, _, err_vec = self.generate_squat_sequence(
                error_type='insufficient_depth',
                depth_scale=self.rng.uniform(0.5, 0.72),
            )
            sequences.append(seq)
            labels.append(1)
            error_vectors.append(err_vec)
        for _ in range(hard_n - hard_n // 2):
            seq, _, err_vec = self.generate_squat_sequence(
                error_type='knee_valgus',
                depth_scale=self.rng.uniform(0.82, 1.0),
            )
            sequences.append(seq)
            labels.append(1)
            error_vectors.append(err_vec)

        sequences = np.array(sequences, dtype=np.float32)
        labels = np.array(labels, dtype=np.int32)
        error_vectors = np.array(error_vectors, dtype=np.float32)

        perm = self.rng.permutation(len(sequences))
        return sequences[perm], labels[perm], error_vectors[perm]
