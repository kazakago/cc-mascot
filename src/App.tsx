import { useRef, useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { VRMAvatar } from './components/VRMAvatar';
import type { VRMAvatarHandle } from './components/VRMAvatar';
import { SettingsButton } from './components/SettingsButton';
import { SettingsModal } from './components/SettingsModal';
import { useWebSocket } from './hooks/useWebSocket';
import { useSpeech } from './hooks/useSpeech';
import { useLipSync } from './hooks/useLipSync';
import './App.css';

const VRM_URL = '/models/avatar.glb';
const ANIMATION_URL = '/animations/idle_loop.vrma';
const WS_URL = `ws://${window.location.host}/ws`;

function App() {
  const avatarRef = useRef<VRMAvatarHandle>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleMouthValueChange = useCallback((value: number) => {
    avatarRef.current?.setMouthOpen(value);
  }, []);

  const { startLipSync, stopLipSync } = useLipSync({
    onMouthValueChange: handleMouthValueChange,
  });

  const { speakText, isReady } = useSpeech({
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
      <SettingsButton onClick={() => setIsSettingsOpen(true)} />

      <Canvas
        camera={{ position: [0, 0.3, 2.0], fov: 30 }}
        style={{ width: '100vw', height: '100vh' }}
      >
        <Scene>
          <VRMAvatar ref={avatarRef} url={VRM_URL} animationUrl={ANIMATION_URL} />
        </Scene>
      </Canvas>

      {!isReady && (
        <div className="audio-overlay">
          Click to enable audio
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
