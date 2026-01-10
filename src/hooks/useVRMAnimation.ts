import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimationMixer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  VRMAnimationLoaderPlugin,
  VRMAnimation,
  createVRMAnimationClip,
} from '@pixiv/three-vrm-animation';
import type { VRM } from '@pixiv/three-vrm';

export function useVRMAnimation(vrm: VRM | null, animationUrl: string) {
  const [vrmAnimation, setVrmAnimation] = useState<VRMAnimation | null>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);

  // Load VRMA file
  useEffect(() => {
    if (!animationUrl) return;

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    loader.loadAsync(animationUrl)
      .then((gltf) => {
        const vrmAnimations = gltf.userData.vrmAnimations as VRMAnimation[] | undefined;
        if (vrmAnimations && vrmAnimations.length > 0) {
          setVrmAnimation(vrmAnimations[0]);
        }
      })
      .catch((err) => {
        console.error('Failed to load VRMA:', err);
      });
  }, [animationUrl]);

  // Setup mixer and play animation
  useEffect(() => {
    if (!vrm || !vrmAnimation) return;

    const mixer = new AnimationMixer(vrm.scene);
    mixerRef.current = mixer;

    const clip = createVRMAnimationClip(vrmAnimation, vrm);
    const action = mixer.clipAction(clip);
    action.play();

    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [vrm, vrmAnimation]);

  const update = useCallback((delta: number) => {
    mixerRef.current?.update(delta);
  }, []);

  return { update };
}
