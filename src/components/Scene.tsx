import type { ReactNode } from "react";

interface SceneProps {
  children: ReactNode;
}

export function Scene({ children }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[1, 1, 1]} intensity={0.8} />
      {children}
    </>
  );
}
