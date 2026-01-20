import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { useVRM } from '../hooks/useVRM';
import { useVRMAnimation } from '../hooks/useVRMAnimation';
import { useBlink } from '../hooks/useBlink';
import type { Emotion } from '../types/emotion';

export interface VRMAvatarHandle {
  setMouthOpen: (value: number) => void;
  setEmotion: (emotion: Emotion, value?: number) => void;
}

interface VRMAvatarProps {
  url: string;
  animationUrl?: string;
  animationLoop?: boolean;
  onAnimationEnd?: () => void;
}

export const VRMAvatar = forwardRef<VRMAvatarHandle, VRMAvatarProps>(
  function VRMAvatar({ url, animationUrl, animationLoop = true, onAnimationEnd }, ref) {
    const { vrm, loading, error, setMouthOpen, setEmotion, update: updateVRM } = useVRM(url);
    const { update: updateAnimation } = useVRMAnimation(vrm, animationUrl || '', {
      loop: animationLoop,
      onAnimationEnd,
    });
    const groupRef = useRef<Group>(null);

    // まばたき機能を有効化
    useBlink(vrm, {
      minInterval: 2000,  // 2秒
      maxInterval: 6000,  // 6秒
      blinkDuration: 150, // 0.15秒
      enabled: true,
    });

    useImperativeHandle(ref, () => ({
      setMouthOpen,
      setEmotion,
    }), [setMouthOpen, setEmotion]);

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
      console.error('VRM load error:', error);
      return null;
    }

    return (
      <group
        ref={groupRef}
        position={[0.15, -0.8, 0]}
        rotation={[0, Math.PI, 0]}
      />
    );
  }
);
