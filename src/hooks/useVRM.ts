import { useState, useEffect, useCallback, useRef } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { VRMLookAtQuaternionProxy } from "@pixiv/three-vrm-animation";
import { Box3, MathUtils } from "three";
import type { Emotion } from "../types/emotion";
import { getExpressionName } from "../types/emotion";

export interface VRMBounds {
  height: number;
  centerX: number;
  minY: number;
}

const EMOTIONS: Emotion[] = ["neutral", "happy", "angry", "sad", "relaxed", "surprised"];
const LERP_FACTOR = 0.1; // Lower = smoother but slower transition

export function useVRM(url: string) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [bounds, setBounds] = useState<VRMBounds | null>(null);
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

    loader
      .loadAsync(url)
      .then((gltf) => {
        const loadedVrm = gltf.userData.vrm as VRM;

        VRMUtils.combineSkeletons(gltf.scene);

        // Create VRMLookAtQuaternionProxy to suppress animation warnings
        if (loadedVrm.lookAt) {
          const lookAtProxy = new VRMLookAtQuaternionProxy(loadedVrm.lookAt);
          lookAtProxy.name = "VRMLookAtQuaternionProxy";
          loadedVrm.scene.add(lookAtProxy);
        }

        // Compute bounding box for auto-fit positioning
        const box = new Box3().setFromObject(loadedVrm.scene);
        const min = box.min;
        const max = box.max;
        setBounds({
          height: max.y - min.y,
          centerX: (min.x + max.x) / 2,
          minY: min.y,
        });

        vrmRef.current = loadedVrm;
        setVrm(loadedVrm);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load VRM:", err);
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

  const setMouthOpen = useCallback(
    (value: number) => {
      if (vrm?.expressionManager) {
        const happyValue = currentEmotionValues.current.happy;
        const sadValue = currentEmotionValues.current.sad;
        // happyが強いほどリップシンクを弱く（0.2〜1.0の範囲）
        // sadが強いほどリップシンクを半分に（0.5〜1.0の範囲）
        // 笑顔時や悲しいときに口が開きすぎてメッシュからはみ出るのを防ぐ
        const happyScale = 1.0 - happyValue * 0.8;
        const sadScale = 1.0 - sadValue * 0.5;
        const scale = happyScale * sadScale;
        const adjustedValue = value * scale;
        vrm.expressionManager.setValue("aa", adjustedValue);
      }
    },
    [vrm],
  );

  const setEmotion = useCallback((emotion: Emotion, value: number = 1.0) => {
    // Set target values for smooth transition
    EMOTIONS.forEach((emo) => {
      targetEmotionValues.current[emo] = emo === emotion ? value : 0;
    });
  }, []);

  const update = useCallback(
    (delta: number) => {
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
    },
    [vrm],
  );

  return { vrm, bounds, loading, error, setMouthOpen, setEmotion, update };
}
