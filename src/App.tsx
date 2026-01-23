import { useRef, useCallback, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { VRMAvatar } from './components/VRMAvatar';
import type { VRMAvatarHandle } from './components/VRMAvatar';
import { useSpeech } from './hooks/useSpeech';
import { useLipSync } from './hooks/useLipSync';
import { useLocalStorage } from './hooks/useLocalStorage';
import { loadVRMFile, createBlobURL } from './utils/vrmStorage';
import type { Emotion } from './types/emotion';

// Helper function to check if point is inside ellipse
function isInsideEllipse(x: number, y: number, centerX: number, centerY: number, radiusX: number, radiusY: number): boolean {
  const dx = x - centerX;
  const dy = y - centerY;
  // Ellipse equation: (x/a)^2 + (y/b)^2 <= 1
  return (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1;
}

const DEFAULT_VRM_URL = '/models/avatar.glb';
const IDLE_ANIMATION_URL = '/animations/idle_loop.vrma';
const EMOTION_ANIMATION_URLS: Partial<Record<Emotion, string>> = {
  happy: '/animations/happy.vrma',
};
const VOICEVOX_BASE_URL = 'http://localhost:8564';

function App() {
  const avatarRef = useRef<VRMAvatarHandle>(null);
  const [speakerId, setSpeakerId] = useLocalStorage('speakerId', 888753760);
  const [volumeScale, setVolumeScale] = useLocalStorage('volumeScale', 1.0);
  const [vrmUrl, setVrmUrl] = useState<string>(DEFAULT_VRM_URL);
  const [currentAnimationUrl, setCurrentAnimationUrl] = useState<string>(IDLE_ANIMATION_URL);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');

  // Load VRM from IndexedDB on mount
  useEffect(() => {
    loadVRMFile().then((file) => {
      if (file) {
        const url = createBlobURL(file);
        setVrmUrl(url);
      }
    }).catch((err) => {
      console.error('Failed to load VRM file:', err);
    });
  }, []);

  // Listen for VRM change notifications from settings window
  useEffect(() => {
    if (window.electron?.onVRMChanged) {
      const cleanup = window.electron.onVRMChanged(() => {
        console.log('[App] VRM file changed, reloading...');
        loadVRMFile().then((file) => {
          if (file) {
            const url = createBlobURL(file);
            setVrmUrl(url);
            console.log('[App] VRM reloaded:', file.name);
          } else {
            // No custom VRM, load default
            setVrmUrl(DEFAULT_VRM_URL);
            console.log('[App] No custom VRM, using default');
          }
        }).catch((err) => {
          console.error('Failed to reload VRM file:', err);
        });
      });

      return cleanup;
    }
  }, []);

  // Listen for speaker change notifications from settings window
  useEffect(() => {
    if (window.electron?.onSpeakerChanged) {
      const cleanup = window.electron.onSpeakerChanged((speakerId: number) => {
        console.log('[App] Speaker changed to:', speakerId);
        setSpeakerId(speakerId);
      });

      return cleanup;
    }
  }, [setSpeakerId]);

  // Listen for volume change notifications from settings window
  useEffect(() => {
    if (window.electron?.onVolumeChanged) {
      const cleanup = window.electron.onVolumeChanged((volumeScale: number) => {
        console.log('[App] Volume changed to:', volumeScale);
        setVolumeScale(volumeScale);
      });

      return cleanup;
    }
  }, [setVolumeScale]);

  const handleMouthValueChange = useCallback((value: number) => {
    avatarRef.current?.setMouthOpen(value);
  }, []);

  const { startLipSync, stopLipSync } = useLipSync({
    onMouthValueChange: handleMouthValueChange,
  });

  const handleSpeechStart = useCallback((analyser: AnalyserNode, emotion: Emotion) => {
    // Set emotion when speech actually starts (after VOICEVOX API processing)
    setCurrentEmotion(emotion);
    avatarRef.current?.setEmotion(emotion);

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
            // Emotion will be set in handleSpeechStart (when speech actually starts)
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

  // Listen for test speech requests from settings window
  useEffect(() => {
    if (window.electron?.onPlayTestSpeech) {
      const cleanup = window.electron.onPlayTestSpeech(() => {
        console.log('[App] Playing test speech');
        speakText('こんにちは。お役に立てることはありますか', 'happy');
      });

      return cleanup;
    }
  }, [speakText]);

  // Custom window drag implementation
  useEffect(() => {
    const electron = window.electron;
    if (!electron?.setIgnoreMouseEvents || !electron?.getWindowPosition || !electron?.setWindowPosition) {
      return;
    }

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let windowStartX = 0;
    let windowStartY = 0;
    let lastInsideState: boolean | null = null;

    const getCharacterRadii = () => {
      // Vertical ellipse: narrow horizontally, tall vertically
      const radiusX = window.innerWidth * 0.15;  // 30% width of window
      const radiusY = window.innerHeight * 0.45; // 90% height of window
      return { radiusX, radiusY };
    };

    const isInsideCharacterArea = (clientX: number, clientY: number) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const { radiusX, radiusY } = getCharacterRadii();
      return isInsideEllipse(clientX, clientY, centerX, centerY, radiusX, radiusY);
    };

    const handleMouseDown = async (e: MouseEvent) => {
      // Only start drag if inside character area and left mouse button
      if (e.button !== 0) return;
      if (!isInsideCharacterArea(e.clientX, e.clientY)) return;

      isDragging = true;
      dragStartX = e.screenX;
      dragStartY = e.screenY;

      const pos = await electron.getWindowPosition();
      windowStartX = pos.x;
      windowStartY = pos.y;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const isInside = isInsideCharacterArea(e.clientX, e.clientY);

      // Update ignore mouse events state (for click-through outside character area)
      if (isInside !== lastInsideState) {
        lastInsideState = isInside;
        electron.setIgnoreMouseEvents(!isInside);
      }

      // Handle dragging
      if (isDragging) {
        const deltaX = e.screenX - dragStartX;
        const deltaY = e.screenY - dragStartY;
        electron.setWindowPosition(windowStartX + deltaX, windowStartY + deltaY);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
      }
    };

    // Set initial state
    electron.setIgnoreMouseEvents(false);

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <Canvas
        camera={{ position: [0, 0.2, 3.2], fov: 30 }}
        style={{ width: '100vw', height: '100vh' }}
        onContextMenu={(e) => {
          e.preventDefault();
          // Open settings window
          if (window.electron?.openSettingsWindow) {
            window.electron.openSettingsWindow();
          }
        }}
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
    </div>
  );
}

export default App;
