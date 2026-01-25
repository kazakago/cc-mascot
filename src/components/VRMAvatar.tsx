import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
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
}

export const VRMAvatar = forwardRef<VRMAvatarHandle, VRMAvatarProps>(function VRMAvatar(
  { url, animationUrl, animationLoop = true, onAnimationEnd, cursorTrackingOptions },
  ref,
) {
  const { vrm, loading, error, setMouthOpen, setEmotion, update: updateVRM } = useVRM(url);
  const { update: updateAnimation } = useVRMAnimation(vrm, animationUrl || "", {
    loop: animationLoop,
    onAnimationEnd,
  });
  const groupRef = useRef<Group>(null);

  // まばたき機能を有効化
  useBlink(vrm, {
    minInterval: 2000, // 2秒
    maxInterval: 6000, // 6秒
    blinkDuration: 150, // 0.15秒
    enabled: true,
  });

  // カーソル追従機能を有効化
  const { updateOptions: updateCursorTracking } = useCursorTracking(vrm, cursorTrackingOptions);

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
