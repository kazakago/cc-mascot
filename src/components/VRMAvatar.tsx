import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { useVRM } from "../hooks/useVRM";
import { useVRMAnimation } from "../hooks/useVRMAnimation";
import { useBlink } from "../hooks/useBlink";
import { useCursorTracking } from "../hooks/useCursorTracking";
import type { Emotion } from "../types/emotion";
import type { CursorTrackingOptions } from "../hooks/useCursorTracking";

export interface VRMAvatarHandle {
  setMouthOpen: (value: number) => void;
  setEmotion: (emotion: Emotion, value?: number) => void;
  updateCursorTracking?: (options: Partial<CursorTrackingOptions>) => void;
}

interface VRMAvatarProps {
  url: string;
  animationUrl?: string;
  animationLoop?: boolean;
  onAnimationEnd?: () => void;
  cursorTrackingOptions?: Partial<CursorTrackingOptions>;
  containerSize?: number;
  onHeadPositionUpdate?: (containerX: number, containerY: number) => void;
}

export const VRMAvatar = forwardRef<VRMAvatarHandle, VRMAvatarProps>(function VRMAvatar(
  {
    url,
    animationUrl,
    animationLoop = true,
    onAnimationEnd,
    cursorTrackingOptions,
    containerSize = 800,
    onHeadPositionUpdate,
  },
  ref,
) {
  const { vrm, loading, error, setMouthOpen, setEmotion, update: updateVRM } = useVRM(url);
  const { update: updateAnimation } = useVRMAnimation(vrm, animationUrl || "", {
    loop: animationLoop,
    onAnimationEnd,
  });
  const groupRef = useRef<Group>(null);
  const { camera } = useThree();

  // まばたき機能を有効化
  useBlink(vrm, {
    minInterval: 2000, // 2秒
    maxInterval: 6000, // 6秒
    blinkDuration: 150, // 0.15秒
    enabled: true,
  });

  // カーソル追従機能を有効化
  const { updateOptions: updateCursorTracking } = useCursorTracking(vrm, cursorTrackingOptions);

  // Update cursor tracking when options change
  useEffect(() => {
    if (cursorTrackingOptions) {
      console.log("[VRMAvatar] cursorTrackingOptions changed:", cursorTrackingOptions);
      updateCursorTracking(cursorTrackingOptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorTrackingOptions]);

  useImperativeHandle(
    ref,
    () => ({
      setMouthOpen,
      setEmotion,
      updateCursorTracking,
    }),
    [setMouthOpen, setEmotion, updateCursorTracking],
  );

  useFrame((_, delta) => {
    updateAnimation(delta);
    updateVRM(delta);

    // Update head position for visualization
    if (vrm && onHeadPositionUpdate) {
      const headBone = vrm.humanoid.getNormalizedBoneNode("head");
      if (headBone) {
        const worldPos = new Vector3();
        headBone.getWorldPosition(worldPos);

        // Project to normalized device coordinates (NDC): -1 to 1
        const ndc = worldPos.clone().project(camera);

        // Convert NDC to container coordinates (0 to containerSize)
        // NDC: x=-1(left) to 1(right), y=-1(bottom) to 1(top)
        const containerX = (ndc.x + 1) * 0.5 * containerSize;
        const containerY = (-ndc.y + 1) * 0.5 * containerSize;

        onHeadPositionUpdate(containerX, containerY);
      }
    }
  });

  useEffect(() => {
    if (vrm && groupRef.current) {
      const group = groupRef.current;
      group.add(vrm.scene);
      return () => {
        group.remove(vrm.scene);
      };
    }
  }, [vrm]);

  if (loading) {
    return null;
  }

  if (error) {
    console.error("VRM load error:", error);
    return null;
  }

  return <group ref={groupRef} position={[0.15, -0.8, 0]} rotation={[0, Math.PI, 0]} />;
});
