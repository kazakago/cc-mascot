import { useRef, useCallback, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { VRMAvatar } from './components/VRMAvatar';
import type { VRMAvatarHandle } from './components/VRMAvatar';
import { SettingsButton } from './components/SettingsButton';
import { SettingsModal } from './components/SettingsModal';
import { useWebSocket } from './hooks/useWebSocket';
import { useSpeech } from './hooks/useSpeech';
import { useLipSync } from './hooks/useLipSync';
import { useLocalStorage } from './hooks/useLocalStorage';
import { loadVRMFile, saveVRMFile, createBlobURL, deleteVRMFile } from './utils/vrmStorage';
import type { Emotion } from './types/emotion';
import './App.css';

const DEFAULT_VRM_URL = '/models/avatar.glb';
const IDLE_ANIMATION_URL = '/animations/idle_loop.vrma';
const SPEAKING_ANIMATION_URLS = [
  '/animations/voice_01.vrma',
  '/animations/voice_02.vrma',
  '/animations/voice_03.vrma',
];
// Electron app always uses localhost:8564 for WebSocket
const WS_URL = 'ws://localhost:8564/ws';

function App() {
  const avatarRef = useRef<VRMAvatarHandle>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [speakerId, setSpeakerId] = useLocalStorage('speakerId', 0);
  const [baseUrl, setBaseUrl] = useLocalStorage('baseUrl', 'http://localhost:50021');
  const [volumeScale, setVolumeScale] = useLocalStorage('volumeScale', 1.0);
  const [vrmUrl, setVrmUrl] = useState<string>(DEFAULT_VRM_URL);
  const [vrmFileName, setVrmFileName] = useState<string | undefined>(undefined);
  const [currentAnimationUrl, setCurrentAnimationUrl] = useState<string>(IDLE_ANIMATION_URL);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');

  // Load VRM from IndexedDB on mount
  useEffect(() => {
    loadVRMFile().then((file) => {
      if (file) {
        const url = createBlobURL(file);
        setVrmUrl(url);
        setVrmFileName(file.name);
      }
    }).catch((err) => {
      console.error('Failed to load VRM file:', err);
    });
  }, []);

  const handleVRMFileChange = useCallback((file: File) => {
    saveVRMFile(file).then(() => {
      const url = createBlobURL(file);
      setVrmUrl(url);
      setVrmFileName(file.name);
    }).catch((err) => {
      console.error('Failed to save VRM file:', err);
    });
  }, []);

  const handleReset = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem('speakerId');
    localStorage.removeItem('baseUrl');
    localStorage.removeItem('volumeScale');

    // Clear IndexedDB
    deleteVRMFile().then(() => {
      // Reload page to apply defaults
      window.location.reload();
    }).catch((err) => {
      console.error('Failed to delete VRM file:', err);
      // Reload anyway
      window.location.reload();
    });
  }, []);

  const handleMouthValueChange = useCallback((value: number) => {
    avatarRef.current?.setMouthOpen(value);
  }, []);

  const { startLipSync, stopLipSync } = useLipSync({
    onMouthValueChange: handleMouthValueChange,
  });

  const handleSpeechStart = useCallback((analyser: AnalyserNode) => {
    const randomIndex = Math.floor(Math.random() * SPEAKING_ANIMATION_URLS.length);
    const randomAnimationUrl = SPEAKING_ANIMATION_URLS[randomIndex];
    setCurrentAnimationUrl(randomAnimationUrl);
    startLipSync(analyser);
  }, [startLipSync]);

  const handleSpeechEnd = useCallback(() => {
    stopLipSync();
    // Reset emotion to neutral after speaking
    setCurrentEmotion('neutral');
    avatarRef.current?.setEmotion('neutral');
  }, [stopLipSync]);

  const handleAnimationEnd = useCallback(() => {
    // When speaking animation ends, return to idle
    setCurrentAnimationUrl(IDLE_ANIMATION_URL);
  }, []);

  const { speakText, isReady } = useSpeech({
    onStart: handleSpeechStart,
    onEnd: handleSpeechEnd,
    speakerId,
    baseUrl,
    volumeScale,
  });

  const handleWebSocketMessage = useCallback(
    (data: { type: string; text: string; emotion?: Emotion }) => {
      if (data.type === 'speak' && data.text) {
        const emotion = data.emotion || 'neutral';
        setCurrentEmotion(emotion);
        avatarRef.current?.setEmotion(emotion);
        speakText(data.text);
      }
    },
    [speakText]
  );

  // Apply emotion when avatar ref changes
  useEffect(() => {
    if (avatarRef.current) {
      avatarRef.current.setEmotion(currentEmotion);
    }
  }, [currentEmotion]);

  useWebSocket({
    url: WS_URL,
    onMessage: handleWebSocketMessage,
  });

  return (
    <div className="app">
      <SettingsButton onClick={() => setIsSettingsOpen(true)} />

      <Canvas
        camera={{ position: [0, 0.2, 2.0], fov: 30 }}
        style={{ width: '100vw', height: '100vh' }}
      >
        <Scene>
          <VRMAvatar
            ref={avatarRef}
            url={vrmUrl}
            animationUrl={currentAnimationUrl}
            animationLoop={currentAnimationUrl === IDLE_ANIMATION_URL}
            onAnimationEnd={handleAnimationEnd}
          />
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
        speakerId={speakerId}
        onSpeakerIdChange={setSpeakerId}
        baseUrl={baseUrl}
        onBaseUrlChange={setBaseUrl}
        volumeScale={volumeScale}
        onVolumeScaleChange={setVolumeScale}
        onVRMFileChange={handleVRMFileChange}
        currentVRMFileName={vrmFileName}
        onReset={handleReset}
      />
    </div>
  );
}

export default App;
