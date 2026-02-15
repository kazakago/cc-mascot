import type { ReactNode } from "react";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

interface SceneProps {
  children: ReactNode;
}

export function Scene({ children }: SceneProps) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[1, 1, 1]} intensity={1.6} />
      {children}
      <EffectComposer>
        <Bloom
          luminanceThreshold={1.0}
          luminanceSmoothing={0.2}
          mipmapBlur
          intensity={1.0}
          radius={0.7}
        />
      </EffectComposer>
    </>
  );
}
