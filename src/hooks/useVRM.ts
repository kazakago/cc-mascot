import { useState, useEffect, useCallback, useRef } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { MathUtils } from 'three';
import type { Emotion } from '../types/emotion';
import { getExpressionName } from '../types/emotion';

const EMOTIONS: Emotion[] = ['neutral', 'happy', 'angry', 'sad', 'relaxed'];
const LERP_FACTOR = 0.1; // Lower = smoother but slower transition

export function useVRM(url: string) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track current and target emotion values for smooth transitions
  const currentEmotionValues = useRef<Record<Emotion, number>>({
    neutral: 1.0,
    happy: 0,
    angry: 0,
    sad: 0,
    relaxed: 0,
  });

  const targetEmotionValues = useRef<Record<Emotion, number>>({
    neutral: 1.0,
    happy: 0,
    angry: 0,
    sad: 0,
    relaxed: 0,
  });

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    setLoading(true);
    setError(null);

    loader.loadAsync(url)
      .then((gltf) => {
        const loadedVrm = gltf.userData.vrm as VRM;

        VRMUtils.removeUnnecessaryJoints(gltf.scene);

        setVrm(loadedVrm);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load VRM:', err);
        setError(err);
        setLoading(false);
      });

    return () => {
      if (vrm) {
        VRMUtils.deepDispose(vrm.scene);
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
          vrm.expressionManager.setValue(expressionName, newValue);
        });
      }

      vrm.update(delta);
    }
  }, [vrm]);

  return { vrm, loading, error, setMouthOpen, setEmotion, update };
}
