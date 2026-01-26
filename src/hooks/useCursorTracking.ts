import { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector2, Vector3, MathUtils, Object3D } from "three";
import type { VRM } from "@pixiv/three-vrm";

export interface CursorTrackingOptions {
  enabled: boolean;
  eyeSensitivity: number; // 0.0 to 2.0
  headSensitivity: number; // 0.0 to 2.0
  trackingRange: number; // 0.0 to 2.0
}

export interface CursorTrackingHandle {
  updateOptions: (options: Partial<CursorTrackingOptions>) => void;
}

const DEFAULT_OPTIONS: CursorTrackingOptions = {
  enabled: true,
  eyeSensitivity: 1.0,
  headSensitivity: 0.5,
  trackingRange: 1.0,
};

// Smooth damping factor (lower = smoother but slower)
const LERP_FACTOR = 0.08;
const MAX_HEAD_ROTATION_X = MathUtils.degToRad(25); // Up/down limit
const MAX_HEAD_ROTATION_Y = MathUtils.degToRad(35); // Left/right limit

export function useCursorTracking(
  vrm: VRM | null,
  initialOptions: Partial<CursorTrackingOptions> = {},
): CursorTrackingHandle {
  const optionsRef = useRef<CursorTrackingOptions>({
    ...DEFAULT_OPTIONS,
    ...initialOptions,
  });

  // Current mouse position (normalized -1 to 1)
  const mousePositionRef = useRef(new Vector2(0, 0));
  // Target position for lookAt
  const lookAtTargetRef = useRef(new Vector3(0, 0, 1));
  // Current head rotation (for smooth interpolation)
  const currentHeadRotationRef = useRef({ x: 0, y: 0 });

  // Track mouse position globally
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Normalize mouse position to -1 to 1 range (for tracking calculation)
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;
      mousePositionRef.current.set(x, y);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Update options method
  const updateOptions = useCallback((newOptions: Partial<CursorTrackingOptions>) => {
    optionsRef.current = { ...optionsRef.current, ...newOptions };
  }, []);

  const { camera } = useThree();

  // Initialize lookAt target when VRM is loaded
  useEffect(() => {
    if (vrm && vrm.lookAt && !vrm.lookAt.target) {
      // Create a target object for lookAt if it doesn't exist
      // Disable linter warning for this specific case as we need to initialize VRM's lookAt target
      // eslint-disable-next-line react-hooks/immutability
      vrm.lookAt.target = new Object3D();
      vrm.lookAt.target.position.set(0, 0, 1);
    }
  }, [vrm]);

  useFrame(() => {
    if (!vrm || !optionsRef.current.enabled) {
      return;
    }

    const { eyeSensitivity, headSensitivity, trackingRange } = optionsRef.current;
    const mouse = mousePositionRef.current;

    // Calculate eye offset Y from head bone position
    // We want the face position to be the "center" of gaze
    let headY = 0; // Default: face is at center
    const headBone = vrm.humanoid.getNormalizedBoneNode("head");
    if (headBone && camera) {
      const worldPos = new Vector3();
      headBone.getWorldPosition(worldPos);

      // Project to screen coordinates
      const screenPos = worldPos.clone().project(camera);
      headY = screenPos.y;
    }

    // Apply range multiplier
    const mouseX = mouse.x * trackingRange;
    const mouseY = mouse.y * trackingRange;

    // === Eye tracking (lookAt) ===
    if (vrm.lookAt && vrm.lookAt.target) {
      // Calculate target position with sensitivity
      // Use headY as the origin (0), so:
      // - When cursor is at face position (mouseY = headY), look at front (0)
      // - When cursor is above face (mouseY > headY), look up (> 0)
      // - When cursor is below face (mouseY < headY), look down (< 0)
      const targetX = mouseX * eyeSensitivity * 2;
      const targetY = (mouseY - headY) * eyeSensitivity * 2;

      // Smoothly interpolate current position to target
      lookAtTargetRef.current.x = MathUtils.lerp(lookAtTargetRef.current.x, targetX, LERP_FACTOR);
      lookAtTargetRef.current.y = MathUtils.lerp(lookAtTargetRef.current.y, targetY, LERP_FACTOR);
      lookAtTargetRef.current.z = 1; // Keep z constant (looking forward)

      // Apply to lookAt target
      vrm.lookAt.target.position.copy(lookAtTargetRef.current);
    }

    // === Head tracking ===
    if (headBone) {
      // Calculate target rotation based on mouse position
      // Use headY as the origin (0), so:
      // - When cursor is at face position (mouseY = headY), face looks forward (0)
      // - When cursor is above face (mouseY > headY), face looks up (> 0)
      // - When cursor is below face (mouseY < headY), face looks down (< 0)
      const targetRotationX = (mouseY - headY) * headSensitivity * MAX_HEAD_ROTATION_X;
      const targetRotationY = mouseX * headSensitivity * MAX_HEAD_ROTATION_Y;

      // Smoothly interpolate current rotation to target
      currentHeadRotationRef.current.x = MathUtils.lerp(currentHeadRotationRef.current.x, targetRotationX, LERP_FACTOR);
      currentHeadRotationRef.current.y = MathUtils.lerp(currentHeadRotationRef.current.y, targetRotationY, LERP_FACTOR);

      // Apply rotation to head bone
      headBone.rotation.x = currentHeadRotationRef.current.x;
      headBone.rotation.y = currentHeadRotationRef.current.y;
    }
  });

  return { updateOptions };
}
