import { useState, useEffect, useCallback, useRef } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';
import { MathUtils } from 'three';
import type { Emotion } from '../types/emotion';
import { getExpressionName } from '../types/emotion';

const EMOTIONS: Emotion[] = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'];
const LERP_FACTOR = 0.1; // Lower = smoother but slower transition

export function useVRM(url: string) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const vrmRef = useRef<VRM | null>(null);

  // Track current and target emotion values for smooth transitions
  const currentEmotionValues = useRef<Record<Emotion, number>>({
    neutral: 1.0,
    happy: 0,
    angry: 0,
    sad: 0,
    relaxed: 0,
    surprised: 0,
  });

  const targetEmotionValues = useRef<Record<Emotion, number>>({
    neutral: 1.0,
    happy: 0,
    angry: 0,
    sad: 0,
    relaxed: 0,
    surprised: 0,
  });

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.loadAsync(url)
      .then((gltf) => {
        const loadedVrm = gltf.userData.vrm as VRM;

        VRMUtils.combineSkeletons(gltf.scene);

        // Create VRMLookAtQuaternionProxy to suppress animation warnings
        if (loadedVrm.lookAt) {
          const lookAtProxy = new VRMLookAtQuaternionProxy(loadedVrm.lookAt);
          lookAtProxy.name = 'VRMLookAtQuaternionProxy';
          loadedVrm.scene.add(lookAtProxy);
        }

        vrmRef.current = loadedVrm;
        setVrm(loadedVrm);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load VRM:', err);
        setError(err);
        setLoading(false);
      });

    return () => {
      if (vrmRef.current) {
        VRMUtils.deepDispose(vrmRef.current.scene);
        vrmRef.current = null;
      }
    };
  }, [url]);

  const setMouthOpen = useCallback((value: number) => {
    if (vrm?.expressionManager) {
      vrm.expressionManager.setValue('aa', value);
    }
  }, [vrm]);

  const setEmotion = useCallback((emotion: Emotion, value: number = 1.0) => {
    // Set target values for smooth transition
    EMOTIONS.forEach((emo) => {
      targetEmotionValues.current[emo] = emo === emotion ? value : 0;
    });
  }, []);

  const update = useCallback((delta: number) => {
    if (vrm) {
      // Smoothly interpolate emotion values
      if (vrm.expressionManager) {
        EMOTIONS.forEach((emotion) => {
          const current = currentEmotionValues.current[emotion];
          const target = targetEmotionValues.current[emotion];

          // Lerp towards target value
          const newValue = MathUtils.lerp(current, target, LERP_FACTOR);
          currentEmotionValues.current[emotion] = newValue;

          // Apply to VRM
          const expressionName = getExpressionName(emotion);
          vrm.expressionManager?.setValue(expressionName, newValue);
        });
      }

      vrm.update(delta);
    }
  }, [vrm]);

  return { vrm, loading, error, setMouthOpen, setEmotion, update };
}
