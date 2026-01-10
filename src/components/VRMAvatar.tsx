import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { useVRM } from '../hooks/useVRM';

export interface VRMAvatarHandle {
  setMouthOpen: (value: number) => void;
}

interface VRMAvatarProps {
  url: string;
}

export const VRMAvatar = forwardRef<VRMAvatarHandle, VRMAvatarProps>(
  function VRMAvatar({ url }, ref) {
    const { vrm, loading, error, setMouthOpen, update } = useVRM(url);
    const groupRef = useRef<Group>(null);

    useImperativeHandle(ref, () => ({
      setMouthOpen,
    }), [setMouthOpen]);

    useFrame((_, delta) => {
      update(delta);
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
        position={[0, -1.3, 0]}
        rotation={[0, Math.PI, 0]}
      />
    );
  }
);
