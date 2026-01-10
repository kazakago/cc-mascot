import { useState, useEffect, useCallback } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export function useVRM(url: string) {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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

  const update = useCallback((delta: number) => {
    if (vrm) {
      vrm.update(delta);
    }
  }, [vrm]);

  return { vrm, loading, error, setMouthOpen, update };
}
