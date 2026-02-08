import { useState, useEffect, useCallback, useRef } from "react";
import { AnimationMixer, AnimationAction, LoopOnce } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMAnimationLoaderPlugin, VRMAnimation, createVRMAnimationClip } from "@pixiv/three-vrm-animation";
import type { VRM } from "@pixiv/three-vrm";

interface UseVRMAnimationOptions {
  loop?: boolean;
  onAnimationEnd?: () => void;
  onAnimationLoop?: () => void;
}

export function useVRMAnimation(vrm: VRM | null, animationUrl: string, options: UseVRMAnimationOptions = {}) {
  const { loop = true, onAnimationEnd, onAnimationLoop } = options;
  const [vrmAnimation, setVrmAnimation] = useState<VRMAnimation | null>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  // Load VRMA file
  useEffect(() => {
    if (!animationUrl) return;

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    loader
      .loadAsync(animationUrl)
      .then((gltf) => {
        const vrmAnimations = gltf.userData.vrmAnimations as VRMAnimation[] | undefined;
        if (vrmAnimations && vrmAnimations.length > 0) {
          setVrmAnimation(vrmAnimations[0]);
        }
      })
      .catch((err) => {
        console.error("Failed to load VRMA:", err);
      });
  }, [animationUrl]);

  // Setup mixer on VRM load
  useEffect(() => {
    if (!vrm) return;

    const mixer = new AnimationMixer(vrm.scene);
    mixerRef.current = mixer;

    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
      currentActionRef.current = null;
    };
  }, [vrm]);

  // Play animation with crossfade
  useEffect(() => {
    if (!vrm || !vrmAnimation || !mixerRef.current) return;

    const mixer = mixerRef.current;
    const clip = createVRMAnimationClip(vrmAnimation, vrm);
    const newAction = mixer.clipAction(clip);

    // Configure loop mode
    if (!loop) {
      newAction.setLoop(LoopOnce, 1);
      newAction.clampWhenFinished = true;
    }

    // Crossfade from previous action to new action
    const previousAction = currentActionRef.current;
    const fadeDuration = 0.5; // 0.5 seconds for smooth transition

    if (previousAction && previousAction !== newAction) {
      // Fade out previous action
      previousAction.fadeOut(fadeDuration);

      // Fade in new action
      newAction.reset();
      newAction.fadeIn(fadeDuration);
      newAction.play();
    } else {
      // First animation or same animation, just play
      newAction.play();
    }

    currentActionRef.current = newAction;

    // Set up animation end callback for non-looping animations
    if (!loop && onAnimationEnd) {
      const handleFinished = (event: { action: AnimationAction }) => {
        if (event.action === newAction) {
          onAnimationEnd();
          mixer.removeEventListener("finished", handleFinished);
        }
      };
      mixer.addEventListener("finished", handleFinished);

      return () => {
        mixer.removeEventListener("finished", handleFinished);
      };
    }

    // Set up loop callback for looping animations
    if (loop && onAnimationLoop) {
      const handleLoop = (event: { action: AnimationAction }) => {
        if (event.action === newAction) {
          onAnimationLoop();
        }
      };
      mixer.addEventListener("loop", handleLoop);

      return () => {
        mixer.removeEventListener("loop", handleLoop);
      };
    }
  }, [vrm, vrmAnimation, loop, onAnimationEnd, onAnimationLoop]);

  const update = useCallback((delta: number) => {
    mixerRef.current?.update(delta);
  }, []);

  return { update };
}
