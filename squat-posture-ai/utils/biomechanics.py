from __future__ import annotations

import numpy as np

from utils.config import LM

class BiomechanicsEngine:
    """Computes biomechanical features from BlazePose landmarks."""

    @staticmethod
    def get_landmark_coords(frame: np.ndarray, idx: int) -> np.ndarray:
        """Extract (x, y, z) for a landmark from a flat frame vector."""
        start = idx * 4
        return frame[start:start + 3]

    @staticmethod
    def compute_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
        """Compute angle at joint b formed by segments ba and bc (degrees)."""
        ba = a - b
        bc = c - b
        cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        return np.degrees(np.arccos(cos_angle))

    @staticmethod
    def compute_inclination(top: np.ndarray, bottom: np.ndarray) -> float:
        """Compute inclination angle from vertical (degrees)."""
        diff = top - bottom
        vertical = np.array([0, -1, 0])  # y-axis points down in image coords
        cos_angle = np.dot(diff, vertical) / (np.linalg.norm(diff) + 1e-8)
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        return np.degrees(np.arccos(cos_angle))

    def extract_joint_angles(self, frame: np.ndarray) -> np.ndarray:
        """Extract all joint angles from a single frame."""
        get = lambda idx: self.get_landmark_coords(frame, idx)

        l_shoulder = get(LM.LEFT_SHOULDER)
        r_shoulder = get(LM.RIGHT_SHOULDER)
        l_hip = get(LM.LEFT_HIP)
        r_hip = get(LM.RIGHT_HIP)
        l_knee = get(LM.LEFT_KNEE)
        r_knee = get(LM.RIGHT_KNEE)
        l_ankle = get(LM.LEFT_ANKLE)
        r_ankle = get(LM.RIGHT_ANKLE)

        mid_shoulder = (l_shoulder + r_shoulder) / 2
        mid_hip = (l_hip + r_hip) / 2

        left_knee_angle = self.compute_angle(l_hip, l_knee, l_ankle)
        right_knee_angle = self.compute_angle(r_hip, r_knee, r_ankle)
        left_hip_angle = self.compute_angle(l_shoulder, l_hip, l_knee)
        right_hip_angle = self.compute_angle(r_shoulder, r_hip, r_knee)
        left_ankle_angle = self.compute_angle(l_knee, l_ankle, get(LM.LEFT_HEEL))
        right_ankle_angle = self.compute_angle(r_knee, r_ankle, get(LM.RIGHT_HEEL))
        torso_inclination = self.compute_inclination(mid_shoulder, mid_hip)
        spine_angle = self.compute_angle(get(LM.NOSE), mid_shoulder, mid_hip)
        shoulder_alignment = abs(l_shoulder[1] - r_shoulder[1]) * 100
        hip_alignment = abs(l_hip[1] - r_hip[1]) * 100

        return np.array([
            left_knee_angle, right_knee_angle,
            left_hip_angle, right_hip_angle,
            left_ankle_angle, right_ankle_angle,
            torso_inclination, spine_angle,
            shoulder_alignment, hip_alignment
        ], dtype=np.float32)

    def extract_symmetry_features(self, frame: np.ndarray) -> np.ndarray:
        """Compute bilateral symmetry metrics."""
        get = lambda idx: self.get_landmark_coords(frame, idx)

        l_knee = get(LM.LEFT_KNEE)
        r_knee = get(LM.RIGHT_KNEE)
        l_hip = get(LM.LEFT_HIP)
        r_hip = get(LM.RIGHT_HIP)
        l_shoulder = get(LM.LEFT_SHOULDER)
        r_shoulder = get(LM.RIGHT_SHOULDER)
        l_ankle = get(LM.LEFT_ANKLE)
        r_ankle = get(LM.RIGHT_ANKLE)

        mid_hip = (l_hip + r_hip) / 2

        knee_symmetry = abs(np.linalg.norm(l_knee - mid_hip) -
                           np.linalg.norm(r_knee - mid_hip))
        hip_symmetry = abs(l_hip[1] - r_hip[1])
        shoulder_symmetry = abs(l_shoulder[1] - r_shoulder[1])
        ankle_symmetry = abs(l_ankle[0] - r_ankle[0]) - abs(l_hip[0] - r_hip[0])

        return np.array([
            knee_symmetry, hip_symmetry,
            shoulder_symmetry, ankle_symmetry
        ], dtype=np.float32)

    def extract_dynamics(self, sequence: np.ndarray, frame_idx: int) -> np.ndarray:
        """Compute motion dynamics features for a frame within a sequence."""
        get_frame = lambda i: self.get_landmark_coords(
            sequence[i], LM.LEFT_HIP
        )

        if frame_idx == 0:
            velocity = np.zeros(3)
            acceleration = np.zeros(3)
        elif frame_idx == 1:
            velocity = get_frame(frame_idx) - get_frame(frame_idx - 1)
            acceleration = np.zeros(3)
        else:
            velocity = get_frame(frame_idx) - get_frame(frame_idx - 1)
            prev_velocity = get_frame(frame_idx - 1) - get_frame(frame_idx - 2)
            acceleration = velocity - prev_velocity

        speed = np.linalg.norm(velocity)
        accel_magnitude = np.linalg.norm(acceleration)

        # Angular velocity (knee angle change rate)
        if frame_idx > 0:
            angles_curr = self.extract_joint_angles(sequence[frame_idx])
            angles_prev = self.extract_joint_angles(sequence[frame_idx - 1])
            angular_velocity = np.mean(np.abs(angles_curr[:2] - angles_prev[:2]))
        else:
            angular_velocity = 0.0

        # Motion smoothness (jerk approximation)
        if frame_idx >= 3:
            positions = [get_frame(frame_idx - i) for i in range(4)]
            jerks = []
            for i in range(len(positions) - 3):
                jerk = positions[i] - 3*positions[i+1] + 3*positions[i+2] - positions[i+3] if i+3 < len(positions) else np.zeros(3)
                jerks.append(np.linalg.norm(jerk))
            smoothness = -np.mean(jerks) if jerks else 0.0
        else:
            smoothness = 0.0

        # Center of mass approximation (weighted average of key joints)
        frame = sequence[frame_idx]
        key_joints = [LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_SHOULDER,
                      LM.RIGHT_SHOULDER, LM.LEFT_KNEE, LM.RIGHT_KNEE]
        com = np.mean([self.get_landmark_coords(frame, j) for j in key_joints], axis=0)
        com_height = com[1]

        return np.array([
            speed, accel_magnitude, angular_velocity, smoothness,
            velocity[1], com_height, com[0], com[2]
        ], dtype=np.float32)

    def extract_frame_features(self, frame: np.ndarray) -> np.ndarray:
        """Extract all engineered features from a single frame (no dynamics)."""
        angles = self.extract_joint_angles(frame)
        symmetry = self.extract_symmetry_features(frame)
        return np.concatenate([angles, symmetry])

    def extract_sequence_features(self, sequence: np.ndarray) -> np.ndarray:
        """Extract complete feature sequence from raw landmark sequence."""
        num_frames = sequence.shape[0]
        features = []

        for i in range(num_frames):
            angles = self.extract_joint_angles(sequence[i])
            symmetry = self.extract_symmetry_features(sequence[i])
            dynamics = self.extract_dynamics(sequence, i)
            frame_features = np.concatenate([angles, symmetry, dynamics])
            features.append(frame_features)

        return np.array(features, dtype=np.float32)


print(f"Features per frame: {cfg.num_joint_angles} angles + {cfg.num_symmetry_features} symmetry + "
      f"{cfg.num_dynamics_features} dynamics = {cfg.num_engineered_features}")
