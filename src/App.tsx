import { useRef, useCallback, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { VRMAvatar } from './components/VRMAvatar';
import type { VRMAvatarHandle } from './components/VRMAvatar';
import { SettingsButton } from './components/SettingsButton';
import { SettingsModal } from './components/SettingsModal';
import { useSpeech } from './hooks/useSpeech';
import { useLipSync } from './hooks/useLipSync';
import { useLocalStorage } from './hooks/useLocalStorage';
import { loadVRMFile, saveVRMFile, createBlobURL, deleteVRMFile } from './utils/vrmStorage';
import type { Emotion } from './types/emotion';

const DEFAULT_VRM_URL = '/models/avatar.glb';
const IDLE_ANIMATION_URL = '/animations/idle_loop.vrma';
const EMOTION_ANIMATION_URLS: Partial<Record<Emotion, string>> = {
  happy: '/animations/happy.vrma',
};
const VOICEVOX_BASE_URL = 'http://localhost:8564';

function App() {
  const avatarRef = useRef<VRMAvatarHandle>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [speakerId, setSpeakerId] = useLocalStorage('speakerId', 888753760);
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

  const handleReset = useCallback(async () => {
    // Clear localStorage
    localStorage.removeItem('speakerId');
    localStorage.removeItem('volumeScale');

    // Clear engine settings in Electron store
    if (window.electron?.resetEngineSettings) {
      try {
        await window.electron.resetEngineSettings();
      } catch (err) {
        console.error('Failed to reset engine settings:', err);
      }
    }

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

  const handleSpeechStart = useCallback((analyser: AnalyserNode, emotion: Emotion) => {
    // Select animation based on emotion
    const animationUrl = EMOTION_ANIMATION_URLS[emotion];
    if (animationUrl) {
      setCurrentAnimationUrl(animationUrl);
    }
    // If no animation for this emotion, keep current animation (idle)

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

  const { speakText } = useSpeech({
    onStart: handleSpeechStart,
    onEnd: handleSpeechEnd,
    speakerId,
    baseUrl: VOICEVOX_BASE_URL,
    volumeScale,
  });

  // Debug: Log when speakerId changes
  useEffect(() => {
    console.log(`[App] Speaker ID changed to: ${speakerId}`);
  }, [speakerId]);

  // Apply emotion when avatar ref changes
  useEffect(() => {
    if (avatarRef.current) {
      avatarRef.current.setEmotion(currentEmotion);
    }
  }, [currentEmotion]);

  // Listen for IPC messages from Electron main process
  useEffect(() => {
    if (window.electron?.onSpeak) {
      const cleanup = window.electron.onSpeak((message: string) => {
        try {
          const data = JSON.parse(message) as { type: string; text: string; emotion?: Emotion };
          if (data.type === 'speak' && data.text) {
            const emotion = data.emotion || 'neutral';
            setCurrentEmotion(emotion);
            avatarRef.current?.setEmotion(emotion);
            speakText(data.text, emotion);
          }
        } catch (err) {
          console.error('Failed to parse speak message:', err);
        }
      });

      // Cleanup: remove listener when speakText changes
      return cleanup;
    }
  }, [speakText]);

  return (
    <div className="w-screen h-screen overflow-hidden">
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

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        speakerId={speakerId}
        onSpeakerIdChange={setSpeakerId}
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
