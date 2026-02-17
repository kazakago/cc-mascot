import { useCallback, type RefObject } from "react";
import type { VRM } from "@pixiv/three-vrm";

// VRM Humanoid finger bone names
const FINGER_BONES = [
  // Left hand
  "leftThumbMetacarpal",
  "leftThumbProximal",
  "leftThumbDistal",
  "leftIndexProximal",
  "leftIndexIntermediate",
  "leftIndexDistal",
  "leftMiddleProximal",
  "leftMiddleIntermediate",
  "leftMiddleDistal",
  "leftRingProximal",
  "leftRingIntermediate",
  "leftRingDistal",
  "leftLittleProximal",
  "leftLittleIntermediate",
  "leftLittleDistal",
  // Right hand
  "rightThumbMetacarpal",
  "rightThumbProximal",
  "rightThumbDistal",
  "rightIndexProximal",
  "rightIndexIntermediate",
  "rightIndexDistal",
  "rightMiddleProximal",
  "rightMiddleIntermediate",
  "rightMiddleDistal",
  "rightRingProximal",
  "rightRingIntermediate",
  "rightRingDistal",
  "rightLittleProximal",
  "rightLittleIntermediate",
  "rightLittleDistal",
] as const;

// Natural relaxed finger rotations (in radians)
// Fingers are slightly curled as in a relaxed hand
const DEG_TO_RAD = Math.PI / 180;

const FINGER_ROTATIONS: Record<string, { x: number; y: number; z: number }> = {
  // Thumb - slightly inward
  leftThumbMetacarpal: { x: 0, y: 0, z: 5 * DEG_TO_RAD },
  leftThumbProximal: { x: 0, y: 0, z: 5 * DEG_TO_RAD },
  leftThumbDistal: { x: 0, y: 0, z: 3 * DEG_TO_RAD },
  rightThumbMetacarpal: { x: 0, y: 0, z: -5 * DEG_TO_RAD },
  rightThumbProximal: { x: 0, y: 0, z: -5 * DEG_TO_RAD },
  rightThumbDistal: { x: 0, y: 0, z: -3 * DEG_TO_RAD },

  // Index finger - gentle curl
  leftIndexProximal: { x: 0, y: 0, z: 8 * DEG_TO_RAD },
  leftIndexIntermediate: { x: 0, y: 0, z: 12 * DEG_TO_RAD },
  leftIndexDistal: { x: 0, y: 0, z: 5 * DEG_TO_RAD },
  rightIndexProximal: { x: 0, y: 0, z: -8 * DEG_TO_RAD },
  rightIndexIntermediate: { x: 0, y: 0, z: -12 * DEG_TO_RAD },
  rightIndexDistal: { x: 0, y: 0, z: -5 * DEG_TO_RAD },

  // Middle finger - slightly more curl
  leftMiddleProximal: { x: 0, y: 0, z: 10 * DEG_TO_RAD },
  leftMiddleIntermediate: { x: 0, y: 0, z: 14 * DEG_TO_RAD },
  leftMiddleDistal: { x: 0, y: 0, z: 6 * DEG_TO_RAD },
  rightMiddleProximal: { x: 0, y: 0, z: -10 * DEG_TO_RAD },
  rightMiddleIntermediate: { x: 0, y: 0, z: -14 * DEG_TO_RAD },
  rightMiddleDistal: { x: 0, y: 0, z: -6 * DEG_TO_RAD },

  // Ring finger
  leftRingProximal: { x: 0, y: 0, z: 11 * DEG_TO_RAD },
  leftRingIntermediate: { x: 0, y: 0, z: 15 * DEG_TO_RAD },
  leftRingDistal: { x: 0, y: 0, z: 7 * DEG_TO_RAD },
  rightRingProximal: { x: 0, y: 0, z: -11 * DEG_TO_RAD },
  rightRingIntermediate: { x: 0, y: 0, z: -15 * DEG_TO_RAD },
  rightRingDistal: { x: 0, y: 0, z: -7 * DEG_TO_RAD },

  // Little finger - most curl
  leftLittleProximal: { x: 0, y: 0, z: 12 * DEG_TO_RAD },
  leftLittleIntermediate: { x: 0, y: 0, z: 16 * DEG_TO_RAD },
  leftLittleDistal: { x: 0, y: 0, z: 8 * DEG_TO_RAD },
  rightLittleProximal: { x: 0, y: 0, z: -12 * DEG_TO_RAD },
  rightLittleIntermediate: { x: 0, y: 0, z: -16 * DEG_TO_RAD },
  rightLittleDistal: { x: 0, y: 0, z: -8 * DEG_TO_RAD },
};

/**
 * Apply default relaxed finger pose to VRM model.
 * This compensates for VRMA animation files that lack finger bone data,
 * preventing fingers from staying in the T-pose (fully extended) position.
 * Call applyDefaultFingerPose() each frame after animation update.
 */
export function useDefaultFingerPose(vrm: VRM | null, isVRM0: boolean, animatedBonesRef: RefObject<Set<string>>) {
  // VRM0.x models are rotated 180° around Y-axis by VRMUtils.rotateVRM0(),
  // which inverts the Z rotation direction for finger curl.
  // VRM0: positive Z = curl inward (for left hand)
  // VRM1: negative Z = curl inward (for left hand)
  const zDirection = isVRM0 ? 1 : -1;

  const applyDefaultFingerPose = useCallback(() => {
    if (!vrm) return;

    const animatedBones = animatedBonesRef.current;

    for (const boneName of FINGER_BONES) {
      const rotation = FINGER_ROTATIONS[boneName];
      if (!rotation) continue;

      const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!bone) continue;

      // Skip bones that are controlled by the current animation.
      // Track names use the Object3D .name (e.g. "J_Bip_L_Index1"),
      // not the VRM humanoid bone name (e.g. "leftIndexProximal").
      if (animatedBones.has(bone.name)) continue;

      bone.rotation.x = rotation.x;
      bone.rotation.y = rotation.y;
      bone.rotation.z = rotation.z * zDirection;
    }
  }, [vrm, zDirection, animatedBonesRef]);

  return { applyDefaultFingerPose };
}
