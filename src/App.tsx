import { useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { VRMAvatar } from './components/VRMAvatar';
import type { VRMAvatarHandle } from './components/VRMAvatar';
import { useWebSocket } from './hooks/useWebSocket';
import { useSpeech } from './hooks/useSpeech';
import { useLipSync } from './hooks/useLipSync';
import './App.css';

const VRM_URL = '/models/yuzukiyukari.glb';
const WS_URL = `ws://${window.location.host}/ws`;

function App() {
  const avatarRef = useRef<VRMAvatarHandle>(null);

  const handleMouthValueChange = useCallback((value: number) => {
    avatarRef.current?.setMouthOpen(value);
  }, []);

  const { startLipSync, stopLipSync } = useLipSync({
    onMouthValueChange: handleMouthValueChange,
  });

  const { speakText } = useSpeech({
    onStart: startLipSync,
    onEnd: stopLipSync,
  });

  const handleWebSocketMessage = useCallback(
    (data: { type: string; text: string }) => {
      if (data.type === 'speak' && data.text) {
        speakText(data.text);
      }
    },
    [speakText]
  );

  useWebSocket({
    url: WS_URL,
    onMessage: handleWebSocketMessage,
  });

  return (
    <div className="app">
      <Canvas
        camera={{ position: [0, 0.3, 3.5], fov: 30 }}
        style={{ width: '100vw', height: '100vh' }}
      >
        <Scene>
          <VRMAvatar ref={avatarRef} url={VRM_URL} />
        </Scene>
      </Canvas>
    </div>
  );
}

export default App;
