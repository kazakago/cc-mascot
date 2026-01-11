import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { useVRM } from '../hooks/useVRM';
import { useVRMAnimation } from '../hooks/useVRMAnimation';

export interface VRMAvatarHandle {
  setMouthOpen: (value: number) => void;
}

interface VRMAvatarProps {
  url: string;
  animationUrl?: string;
  animationLoop?: boolean;
  onAnimationEnd?: () => void;
}

export const VRMAvatar = forwardRef<VRMAvatarHandle, VRMAvatarProps>(
  function VRMAvatar({ url, animationUrl, animationLoop = true, onAnimationEnd }, ref) {
    const { vrm, loading, error, setMouthOpen, update: updateVRM } = useVRM(url);
    const { update: updateAnimation } = useVRMAnimation(vrm, animationUrl || '', {
      loop: animationLoop,
      onAnimationEnd,
    });
    const groupRef = useRef<Group>(null);

    useImperativeHandle(ref, () => ({
      setMouthOpen,
    }), [setMouthOpen]);

    useFrame((_, delta) => {
      updateAnimation(delta);
      updateVRM(delta);
    });

    useEffect(() => {
      if (vrm && groupRef.current) {
        groupRef.current.add(vrm.scene);
        return () => {
          groupRef.current?.remove(vrm.scene);
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
        position={[0.1, -1.2, 0]}
        rotation={[0, Math.PI, 0]}
      />
    );
  }
);
