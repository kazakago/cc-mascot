import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./components/Scene";
import { VRMAvatar } from "./components/VRMAvatar";
import type { VRMAvatarHandle } from "./components/VRMAvatar";
import { useSpeech } from "./hooks/useSpeech";
import { useLipSync } from "./hooks/useLipSync";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { loadVRMFile, createBlobURL } from "./utils/vrmStorage";
import type { Emotion } from "./types/emotion";
import type { CursorTrackingOptions } from "./hooks/useCursorTracking";

// Helper function to check if point is inside ellipse
function isInsideEllipse(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
): boolean {
  const dx = x - centerX;
  const dy = y - centerY;
  // Ellipse equation: (x/a)^2 + (y/b)^2 <= 1
  return (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1;
}

// クリック可能領域（楕円）のパラメータ
// キャラクターの表示位置に合わせて調整（頭: 画面上21%, 足: 画面外下）
const ELLIPSE_RADIUS_X = 0.15; // コンテナ幅に対する横半径の比率
const ELLIPSE_RADIUS_Y = 0.45; // コンテナ高さに対する縦半径の比率
const ELLIPSE_CENTER_Y_OFFSET = 0.03; // コンテナ中心からの下方オフセット比率

const DEFAULT_VRM_URL = "./models/avatar.glb";
const IDLE_ANIMATION_URL = "./animations/idle_loop.vrma";
const IDLE_RANDOM_ANIMATION_URLS = [
  "./animations/idle_anim1.vrma",
  "./animations/idle_anim2.vrma",
  "./animations/idle_anim3.vrma",
  "./animations/idle_anim4.vrma",
];
const IDLE_RANDOM_MIN_INTERVAL = 30000; // 30秒
const IDLE_RANDOM_MAX_INTERVAL = 60000; // 60秒
const EMOTION_ANIMATION_URLS: Partial<Record<Emotion, string[]>> = {
  happy: ["./animations/happy1.vrma", "./animations/happy2.vrma"],
  angry: ["./animations/angry.vrma"],
  sad: ["./animations/sad.vrma"],
  relaxed: ["./animations/relaxed.vrma"],
};
const VOICEVOX_BASE_URL = "http://localhost:8564";

function App() {
  const avatarRef = useRef<VRMAvatarHandle>(null);
  const [speakerId, setSpeakerId] = useLocalStorage("speakerId", 888753760);
  const [volumeScale, setVolumeScale] = useLocalStorage("volumeScale", 1.0);
  const [vrmUrl, setVrmUrl] = useState<string>(DEFAULT_VRM_URL);
  const [currentAnimationUrl, setCurrentAnimationUrl] = useState<string>(IDLE_ANIMATION_URL);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral");
  const [containerCenter, setContainerCenter] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState(800);
  const [isInitialized, setIsInitialized] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [headPosition, setHeadPosition] = useState<{ x: number; y: number } | null>(null);
  const [muteOnMicActive, setMuteOnMicActive] = useState(true);
  const [micActive, setMicActive] = useState(false);

  // ランダム待機アニメーション用ref
  const isSpeakingRef = useRef(false);
  const lastIdleAnimTimeRef = useRef(0);
  const nextIdleIntervalRef = useRef(0);
  const enableIdleAnimationsRef = useRef(true);
  const enableSpeechAnimationsRef = useRef(true);

  // 初回マウント時にランダム待機タイマーを初期化
  useEffect(() => {
    lastIdleAnimTimeRef.current = Date.now();
    nextIdleIntervalRef.current =
      IDLE_RANDOM_MIN_INTERVAL + Math.random() * (IDLE_RANDOM_MAX_INTERVAL - IDLE_RANDOM_MIN_INTERVAL);
  }, []);

  // Cursor tracking settings (fixed values)
  const cursorTrackingOptions: Partial<CursorTrackingOptions> = useMemo(
    () => ({
      enabled: true,
      eyeSensitivity: 0.4,
      headSensitivity: 0.1,
      containerSize: containerSize,
      containerX: containerCenter.x - containerSize / 2,
      containerY: containerCenter.y - containerSize / 2,
    }),
    [containerSize, containerCenter.x, containerCenter.y],
  );

  // Refs for event handlers (updated immediately on state changes)
  const containerCenterRef = useRef(containerCenter);
  const containerSizeRef = useRef(containerSize);

  // Update cursor tracking when container position or size changes
  useEffect(() => {
    if (avatarRef.current?.updateCursorTracking) {
      avatarRef.current.updateCursorTracking({
        containerSize: containerSize,
        containerX: containerCenter.x - containerSize / 2,
        containerY: containerCenter.y - containerSize / 2,
      });
    }
  }, [containerSize, containerCenter.x, containerCenter.y]);

  // Initialize character position and size from Electron Store
  useEffect(() => {
    const init = async () => {
      const electron = window.electron;
      if (!electron?.getCharacterSize || !electron?.getCharacterPosition || !electron?.getScreenSize) {
        setIsInitialized(true);
        return;
      }

      const [savedSize, savedPosition, screenSize] = await Promise.all([
        electron.getCharacterSize(),
        electron.getCharacterPosition(),
        electron.getScreenSize(),
      ]);

      const size = savedSize || 800;
      setContainerSize(size);
      containerSizeRef.current = size;

      if (savedPosition) {
        // savedPosition is top-left, convert to center
        const center = {
          x: savedPosition.x + size / 2,
          y: savedPosition.y + size / 2,
        };
        setContainerCenter(center);
        containerCenterRef.current = center;
      } else {
        // Default: center-bottom of screen
        const center = {
          x: Math.round(screenSize.width / 2),
          y: Math.round(screenSize.height - size / 2),
        };
        setContainerCenter(center);
        containerCenterRef.current = center;
      }

      setIsInitialized(true);
    };
    init();
  }, []);

  // Listen for character size changes from settings window
  useEffect(() => {
    if (!window.electron?.onCharacterSizeChanged) return;

    let positionPersistTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = window.electron.onCharacterSizeChanged((newSize: number) => {
      containerSizeRef.current = newSize;
      setContainerSize(newSize);

      // Debounce position persistence to reduce IPC traffic during rapid slider events
      if (positionPersistTimer) clearTimeout(positionPersistTimer);
      positionPersistTimer = setTimeout(() => {
        const center = containerCenterRef.current;
        const topLeftX = Math.round(center.x - containerSizeRef.current / 2);
        const topLeftY = Math.round(center.y - containerSizeRef.current / 2);
        window.electron?.setCharacterPosition?.(topLeftX, topLeftY);
      }, 300);
    });

    return () => {
      cleanup?.();
      if (positionPersistTimer) {
        clearTimeout(positionPersistTimer);
        // Persist final position on cleanup
        const center = containerCenterRef.current;
        const topLeftX = Math.round(center.x - containerSizeRef.current / 2);
        const topLeftY = Math.round(center.y - containerSizeRef.current / 2);
        window.electron?.setCharacterPosition?.(topLeftX, topLeftY);
      }
    };
  }, []);

  // Listen for character position reset from settings window
  useEffect(() => {
    if (!window.electron?.onCharacterPositionReset || !window.electron?.getScreenSize) return;

    const cleanup = window.electron.onCharacterPositionReset(async () => {
      const screenSize = await window.electron!.getScreenSize();
      const size = containerSizeRef.current;
      const center = {
        x: Math.round(screenSize.width / 2),
        y: Math.round(screenSize.height - size / 2),
      };
      setContainerCenter(center);
      containerCenterRef.current = center;
    });

    return () => {
      cleanup?.();
    };
  }, []);

  // Load VRM from IndexedDB on mount
  useEffect(() => {
    loadVRMFile()
      .then((file) => {
        if (file) {
          const url = createBlobURL(file);
          setVrmUrl(url);
        }
      })
      .catch((err) => {
        console.error("Failed to load VRM file:", err);
      });
  }, []);

  // Listen for VRM change notifications from settings window
  useEffect(() => {
    if (window.electron?.onVRMChanged) {
      const cleanup = window.electron.onVRMChanged(() => {
        console.log("[App] VRM file changed, reloading...");
        loadVRMFile()
          .then((file) => {
            if (file) {
              const url = createBlobURL(file);
              setVrmUrl(url);
              console.log("[App] VRM reloaded:", file.name);
            } else {
              // No custom VRM, load default
              setVrmUrl(DEFAULT_VRM_URL);
              console.log("[App] No custom VRM, using default");
            }
          })
          .catch((err) => {
            console.error("Failed to reload VRM file:", err);
          });
      });

      return cleanup;
    }
  }, []);

  // Listen for speaker change notifications from settings window
  useEffect(() => {
    if (window.electron?.onSpeakerChanged) {
      const cleanup = window.electron.onSpeakerChanged((speakerId: number) => {
        console.log("[App] Speaker changed to:", speakerId);
        setSpeakerId(speakerId);
      });

      return cleanup;
    }
  }, [setSpeakerId]);

  // Listen for volume change notifications from settings window
  useEffect(() => {
    if (window.electron?.onVolumeChanged) {
      const cleanup = window.electron.onVolumeChanged((volumeScale: number) => {
        console.log("[App] Volume changed to:", volumeScale);
        setVolumeScale(volumeScale);
      });

      return cleanup;
    }
  }, [setVolumeScale]);

  // Load muteOnMicActive setting, initial mic state, and listen for changes
  useEffect(() => {
    window.electron?.getMuteOnMicActive?.().then(setMuteOnMicActive);
    window.electron?.getMicActive?.().then(setMicActive);

    const cleanups: (() => void)[] = [];

    const cleanupMic = window.electron?.onMicActiveChanged?.((active) => {
      console.log(`[App] Mic active: ${active}`);
      setMicActive(active);
    });
    if (cleanupMic) cleanups.push(cleanupMic);

    const cleanupSetting = window.electron?.onMuteOnMicActiveChanged?.((value) => {
      console.log(`[App] Mute on mic active changed: ${value}`);
      setMuteOnMicActive(value);
    });
    if (cleanupSetting) cleanups.push(cleanupSetting);

    return () => cleanups.forEach((fn) => fn());
  }, []);

  // Load motion settings and listen for changes
  useEffect(() => {
    window.electron?.getEnableIdleAnimations?.().then((value) => {
      enableIdleAnimationsRef.current = value;
    });
    window.electron?.getEnableSpeechAnimations?.().then((value) => {
      enableSpeechAnimationsRef.current = value;
    });

    const cleanups: (() => void)[] = [];

    const cleanupIdle = window.electron?.onEnableIdleAnimationsChanged?.((value) => {
      enableIdleAnimationsRef.current = value;
    });
    if (cleanupIdle) cleanups.push(cleanupIdle);

    const cleanupSpeech = window.electron?.onEnableSpeechAnimationsChanged?.((value) => {
      enableSpeechAnimationsRef.current = value;
    });
    if (cleanupSpeech) cleanups.push(cleanupSpeech);

    return () => cleanups.forEach((fn) => fn());
  }, []);

  const handleMouthValueChange = useCallback((value: number) => {
    avatarRef.current?.setMouthOpen(value);
  }, []);

  const { startLipSync, stopLipSync } = useLipSync({
    onMouthValueChange: handleMouthValueChange,
  });

  const handleSpeechStart = useCallback(
    (analyser: AnalyserNode, emotion: Emotion) => {
      isSpeakingRef.current = true;
      // Set emotion when speech actually starts (after VOICEVOX API processing)
      setCurrentEmotion(emotion);
      avatarRef.current?.setEmotion(emotion);

      // Select animation based on emotion (randomly choose from array)
      if (enableSpeechAnimationsRef.current) {
        const animationUrls = EMOTION_ANIMATION_URLS[emotion];
        if (animationUrls && animationUrls.length > 0) {
          const randomIndex = Math.floor(Math.random() * animationUrls.length);
          const animationUrl = animationUrls[randomIndex];
          setCurrentAnimationUrl(animationUrl);
        }
      }
      // If disabled or no animation for this emotion, keep current animation (idle)

      startLipSync(analyser);
    },
    [startLipSync],
  );

  const handleSpeechEnd = useCallback(() => {
    isSpeakingRef.current = false;
    // Reset random idle timer to prevent immediate trigger after speaking
    lastIdleAnimTimeRef.current = Date.now();
    nextIdleIntervalRef.current =
      IDLE_RANDOM_MIN_INTERVAL + Math.random() * (IDLE_RANDOM_MAX_INTERVAL - IDLE_RANDOM_MIN_INTERVAL);
    stopLipSync();
    // Reset emotion to neutral after speaking
    setCurrentEmotion("neutral");
    avatarRef.current?.setEmotion("neutral");
  }, [stopLipSync]);

  const handleAnimationEnd = useCallback(() => {
    // When animation ends, return to idle and reset random idle timer
    setCurrentAnimationUrl(IDLE_ANIMATION_URL);
    lastIdleAnimTimeRef.current = Date.now();
    nextIdleIntervalRef.current =
      IDLE_RANDOM_MIN_INTERVAL + Math.random() * (IDLE_RANDOM_MAX_INTERVAL - IDLE_RANDOM_MIN_INTERVAL);
  }, []);

  const handleAnimationLoop = useCallback(() => {
    if (isSpeakingRef.current) return;
    if (!enableIdleAnimationsRef.current) return;
    const elapsed = Date.now() - lastIdleAnimTimeRef.current;
    if (elapsed < nextIdleIntervalRef.current) return;
    const randomIndex = Math.floor(Math.random() * IDLE_RANDOM_ANIMATION_URLS.length);
    setCurrentAnimationUrl(IDLE_RANDOM_ANIMATION_URLS[randomIndex]);
  }, []);

  const { speakText } = useSpeech({
    onStart: handleSpeechStart,
    onEnd: handleSpeechEnd,
    speakerId,
    baseUrl: VOICEVOX_BASE_URL,
    volumeScale,
    isMicMuted: micActive && muteOnMicActive,
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
          if (data.type === "speak" && data.text) {
            const emotion = data.emotion || "neutral";
            // Emotion will be set in handleSpeechStart (when speech actually starts)
            speakText(data.text, emotion);
          }
        } catch (err) {
          console.error("Failed to parse speak message:", err);
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
        console.log("[App] Playing test speech");
        speakText("こんにちは。お役に立てることはありますか？", "happy");
      });

      return cleanup;
    }
  }, [speakText]);

  // Custom container drag and click-through implementation
  useEffect(() => {
    const electron = window.electron;
    if (!electron?.setIgnoreMouseEvents) {
      return;
    }

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let containerStartCenterX = 0;
    let containerStartCenterY = 0;
    let lastInsideState: boolean | null = null;

    const isInsideCharacterArea = (clientX: number, clientY: number) => {
      const center = containerCenterRef.current;
      const size = containerSizeRef.current;
      const radiusX = size * ELLIPSE_RADIUS_X;
      const radiusY = size * ELLIPSE_RADIUS_Y;
      const ellipseCenterY = center.y + size * ELLIPSE_CENTER_Y_OFFSET;
      return isInsideEllipse(clientX, clientY, center.x, ellipseCenterY, radiusX, radiusY);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!isInsideCharacterArea(e.clientX, e.clientY)) return;

      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      containerStartCenterX = containerCenterRef.current.x;
      containerStartCenterY = containerCenterRef.current.y;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const isInside = isInsideCharacterArea(e.clientX, e.clientY);

      if (isInside !== lastInsideState) {
        lastInsideState = isInside;
        electron.setIgnoreMouseEvents(devToolsOpen ? false : !isInside);
      }

      if (isDragging) {
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        const newCenterX = containerStartCenterX + deltaX;
        const newCenterY = containerStartCenterY + deltaY;
        containerCenterRef.current = { x: newCenterX, y: newCenterY };
        setContainerCenter({ x: newCenterX, y: newCenterY });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        // Persist position (convert center to top-left)
        const center = containerCenterRef.current;
        const size = containerSizeRef.current;
        const topLeftX = Math.round(center.x - size / 2);
        const topLeftY = Math.round(center.y - size / 2);
        electron.setCharacterPosition?.(topLeftX, topLeftY);
      }
    };

    electron.setIgnoreMouseEvents(false);

    const cleanupFunctions: (() => void)[] = [];

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    cleanupFunctions.push(() => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    });

    if (electron.onDevToolsStateChanged) {
      const cleanupDevTools = electron.onDevToolsStateChanged((isOpen: boolean) => {
        console.log(`[App] DevTools state changed: ${isOpen ? "opened" : "closed"}`);
        setDevToolsOpen(isOpen);
        if (isOpen) {
          electron.setIgnoreMouseEvents(false);
        } else if (lastInsideState !== null) {
          electron.setIgnoreMouseEvents(!lastInsideState);
        }
      });
      cleanupFunctions.push(cleanupDevTools);
    }

    return () => {
      cleanupFunctions.forEach((fn) => fn());
    };
  }, [devToolsOpen]);

  // Debounced render size: actual canvas/div dimensions.
  // During rapid slider movement, only CSS scale() changes (GPU-only, no layout reflow).
  // When slider stops, renderSize catches up and canvas resizes to correct resolution.
  const [renderSize, setRenderSize] = useState(containerSize);
  useEffect(() => {
    if (renderSize === containerSize) return;
    const timer = setTimeout(() => setRenderSize(containerSize), 150);
    return () => clearTimeout(timer);
  }, [containerSize, renderSize]);

  // Calculate ellipse parameters for visualization (in renderSize coordinate space)
  const ellipseParams = {
    centerX: renderSize / 2,
    centerY: renderSize / 2 + renderSize * ELLIPSE_CENTER_Y_OFFSET,
    radiusX: renderSize * ELLIPSE_RADIUS_X,
    radiusY: renderSize * ELLIPSE_RADIUS_Y,
  };

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      {isInitialized && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: `${renderSize}px`,
            height: `${renderSize}px`,
            transform: `translate(${containerCenter.x - containerSize / 2}px, ${containerCenter.y - containerSize / 2}px) scale(${containerSize / renderSize})`,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          <Canvas
            camera={{ position: [0, 0.2, 3.2], fov: 30 }}
            style={{ width: "100%", height: "100%" }}
            onContextMenu={(e) => {
              e.preventDefault();
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
                onAnimationLoop={handleAnimationLoop}
                cursorTrackingOptions={cursorTrackingOptions}
                containerSize={renderSize}
                onHeadPositionUpdate={(containerX, containerY) => {
                  // containerX and containerY are in container coordinates (0 to renderSize)
                  setHeadPosition({ x: containerX, y: containerY });
                }}
              />
            </Scene>
          </Canvas>

          {/* TEST: Local size slider with mode toggle - only shown when DevTools is open */}
          {devToolsOpen && (
            <div
              style={{
                position: "absolute",
                bottom: 10,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 9999,
                background: "rgba(0,0,0,0.7)",
                padding: "8px 16px",
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                pointerEvents: "auto",
              }}
            >
              <span style={{ color: "white", fontSize: 12 }}>{containerSize}px</span>
              <input
                type="range"
                min={400}
                max={1200}
                step={10}
                value={containerSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  containerSizeRef.current = newSize;
                  setContainerSize(newSize);
                }}
                style={{ width: 250 }}
              />
            </div>
          )}

          {/* Visualize draggable area when DevTools is open */}
          {devToolsOpen && (
            <svg
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
              viewBox={`0 0 ${renderSize} ${renderSize}`}
            >
              <ellipse
                cx={ellipseParams.centerX}
                cy={ellipseParams.centerY}
                rx={ellipseParams.radiusX}
                ry={ellipseParams.radiusY}
                fill="none"
                stroke="rgba(255, 0, 0, 0.7)"
                strokeWidth="3"
                strokeDasharray="10, 5"
              />
              {/* Visualize cursor tracking origin (head position) */}
              {headPosition && (
                <>
                  {/* Horizontal line through head position */}
                  <line
                    x1="0"
                    y1={headPosition.y}
                    x2={renderSize}
                    y2={headPosition.y}
                    stroke="rgba(0, 255, 0, 0.5)"
                    strokeWidth="2"
                    strokeDasharray="5, 5"
                  />
                  {/* Vertical line through head position */}
                  <line
                    x1={headPosition.x}
                    y1="0"
                    x2={headPosition.x}
                    y2={renderSize}
                    stroke="rgba(0, 255, 0, 0.5)"
                    strokeWidth="2"
                    strokeDasharray="5, 5"
                  />
                  {/* Head position point */}
                  <circle
                    cx={headPosition.x}
                    cy={headPosition.y}
                    r="8"
                    fill="rgba(0, 255, 0, 0.8)"
                    stroke="rgba(0, 255, 0, 1)"
                    strokeWidth="2"
                  />
                  {/* Label for head position */}
                  <text
                    x={headPosition.x + 15}
                    y={headPosition.y - 10}
                    fill="rgba(0, 255, 0, 0.9)"
                    fontSize="14"
                    fontWeight="bold"
                  >
                    視線の原点
                  </text>
                </>
              )}
            </svg>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
