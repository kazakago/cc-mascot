import { useState, useEffect, useRef, useCallback } from "react";
import type { EngineType } from "../global";
import { getSpeakers } from "../services/voicevox";
import { saveVRMFile, loadVRMFile } from "../utils/vrmStorage";

const VOICEVOX_BASE_URL = "http://localhost:8564";

interface SpeakerOption {
  id: number;
  name: string;
  speakerName: string;
}

interface SettingsPanelProps {
  speakerId: number;
  onSpeakerIdChange: (id: number) => void;
  volumeScale: number;
  onVolumeScaleChange: (volume: number) => void;
  containerSize: number;
  onContainerSizeChange: (size: number) => void;
  onVRMChange: () => void;
  onTestSpeech: () => void;
  enableIdleAnimations: boolean;
  onEnableIdleAnimationsChange: (value: boolean) => void;
  enableSpeechAnimations: boolean;
  onEnableSpeechAnimationsChange: (value: boolean) => void;
  muteOnMicActive: boolean;
  onMuteOnMicActiveChange: (value: boolean) => void;
  onResetCharacterPosition: () => void;
  onResetAllSettings: () => void;
  onClose: () => void;
}

export default function SettingsPanel({
  speakerId,
  onSpeakerIdChange,
  volumeScale,
  onVolumeScaleChange,
  containerSize,
  onContainerSizeChange,
  onVRMChange,
  onTestSpeech,
  enableIdleAnimations,
  onEnableIdleAnimationsChange,
  enableSpeechAnimations,
  onEnableSpeechAnimationsChange,
  muteOnMicActive,
  onMuteOnMicActiveChange,
  onResetCharacterPosition,
  onResetAllSettings,
  onClose,
}: SettingsPanelProps) {
  const [vrmFileName, setVrmFileName] = useState<string | undefined>(undefined);
  const [engineType, setEngineType] = useState<EngineType>("aivis");
  const [defaultEnginePath, setDefaultEnginePath] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [error, setError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<SpeakerOption[]>([]);
  const [loadingSpeakers, setLoadingSpeakers] = useState(false);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [testAudioError, setTestAudioError] = useState("");
  const [micMonitorAvailable, setMicMonitorAvailable] = useState(false);
  const [includeSubAgents, setIncludeSubAgents] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch speakers from engine with retry logic
  const fetchSpeakers = useCallback(async (maxRetries = 10) => {
    setLoadingSpeakers(true);
    setError("");

    for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
      try {
        const speakerList = await getSpeakers(VOICEVOX_BASE_URL);
        const options: SpeakerOption[] = [];
        for (const speaker of speakerList) {
          for (const style of speaker.styles) {
            options.push({
              id: style.id,
              name: style.name,
              speakerName: speaker.name,
            });
          }
        }
        setSpeakers(options);
        setLoadingSpeakers(false);
        return options;
      } catch (err) {
        if (retryCount < maxRetries) {
          console.log(`[SettingsPanel] Engine not ready, retrying (${retryCount + 1}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          console.error("Failed to fetch speakers after retries:", err);
          setError("Failed to fetch speakers. Is the engine running?");
          setSpeakers([]);
          setLoadingSpeakers(false);
          return [];
        }
      }
    }
    return [];
  }, []);

  // Load initial values from Electron Store
  useEffect(() => {
    const loadInitialValues = async () => {
      if (window.electron?.getEngineType && window.electron?.getVoicevoxPath) {
        const [savedEngineType, savedCustomPath] = await Promise.all([
          window.electron.getEngineType(),
          window.electron.getVoicevoxPath(),
        ]);
        const effectiveEngineType = savedEngineType || "aivis";
        setEngineType(effectiveEngineType);
        setCustomPath(savedCustomPath || "");

        if (effectiveEngineType !== "custom" && window.electron?.getDefaultEnginePath) {
          const path = await window.electron.getDefaultEnginePath(effectiveEngineType);
          setDefaultEnginePath(path);
        }
      }

      if (window.electron?.getMicMonitorAvailable) {
        const available = await window.electron.getMicMonitorAvailable();
        setMicMonitorAvailable(available);
      }

      if (window.electron?.getIncludeSubAgents) {
        const include = await window.electron.getIncludeSubAgents();
        setIncludeSubAgents(include);
      }

      // Load VRM file name from IndexedDB
      try {
        const vrmFile = await loadVRMFile();
        if (vrmFile) {
          setVrmFileName(vrmFile.name);
        }
      } catch (err) {
        console.error("[SettingsPanel] Failed to load VRM file:", err);
      }
    };
    loadInitialValues();
  }, []);

  // Fetch speakers on mount
  useEffect(() => {
    fetchSpeakers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fetchSpeakers is stable (useCallback with empty deps)

  // Restart engine with current settings
  const restartEngine = async (engineTypeOverride?: EngineType, pathOverride?: string) => {
    setLoadingSpeakers(true);
    setSpeakers([]);
    setError("");

    const effectiveEngineType = engineTypeOverride !== undefined ? engineTypeOverride : engineType;
    const effectivePath =
      pathOverride !== undefined ? pathOverride : effectiveEngineType === "custom" ? customPath.trim() : undefined;

    if (window.electron?.setEngineSettings) {
      try {
        console.log(`[SettingsPanel] Restarting engine: type=${effectiveEngineType}, path=${effectivePath}`);
        const started = await window.electron.setEngineSettings(effectiveEngineType, effectivePath);

        if (!started) {
          setError("エンジンの起動に失敗しました。エンジンがインストールされているか確認してください。");
          setLoadingSpeakers(false);
          return;
        }

        const newSpeakers = await fetchSpeakers();

        if (newSpeakers.length > 0) {
          const currentExists = newSpeakers.some((s) => s.id === speakerId);
          if (!currentExists) {
            const firstSpeakerId = newSpeakers[0].id;
            onSpeakerIdChange(firstSpeakerId);
            window.electron?.setSpeakerId?.(firstSpeakerId);
            console.log(`[SettingsPanel] Auto-selected first speaker: ${firstSpeakerId}`);
          }
        }
      } catch (err) {
        console.error("Failed to restart engine:", err);
        setError("Failed to restart engine");
        setLoadingSpeakers(false);
      }
    }
  };

  const handleEngineTypeChange = async (newEngineType: EngineType) => {
    setEngineType(newEngineType);

    if (newEngineType !== "custom" && window.electron?.getDefaultEnginePath) {
      const path = await window.electron.getDefaultEnginePath(newEngineType);
      setDefaultEnginePath(path);
    }

    if (newEngineType === "custom") {
      if (!customPath.trim()) {
        console.log("[SettingsPanel] Custom engine selected but path is empty, skipping restart");
        setSpeakers([]);
        setLoadingSpeakers(false);
        return;
      }
    }

    await restartEngine(newEngineType);
  };

  const handleApplyCustomPath = async () => {
    if (!customPath.trim()) {
      setError("Please enter a custom engine path");
      return;
    }
    await restartEngine("custom", customPath.trim());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".glb") && !file.name.toLowerCase().endsWith(".vrm")) {
        setError("Please select a VRM (.vrm or .glb) file");
        return;
      }
      setSelectedFileName(file.name);
      setVrmFileName(file.name);
      saveVRMFile(file)
        .then(() => {
          console.log("[SettingsPanel] VRM file saved");
          onVRMChange();
        })
        .catch((err) => {
          console.error("[SettingsPanel] Failed to save VRM file:", err);
          setError("Failed to save VRM file");
        });
      setError("");
    }
  };

  const handleSpeakerChange = (newSpeakerId: number) => {
    onSpeakerIdChange(newSpeakerId);
    window.electron?.setSpeakerId?.(newSpeakerId);
    console.log(`[SettingsPanel] Speaker changed to: ${newSpeakerId}`);
  };

  const handleVolumeChange = (newVolume: number) => {
    onVolumeScaleChange(newVolume);
  };

  const handleVolumeChangeComplete = () => {
    window.electron?.setVolumeScale?.(volumeScale);
    console.log(`[SettingsPanel] Volume saved: ${volumeScale}`);
  };

  const handleCharacterSizeChange = (newSize: number) => {
    onContainerSizeChange(newSize);

    // Persist to Electron Store (fire and forget)
    window.electron?.setCharacterSize?.(newSize).catch((err: unknown) => {
      console.error("Failed to change character size:", err);
      setError("Failed to change character size");
    });
  };

  const handleIncludeSubAgentsChange = async (value: boolean) => {
    setIncludeSubAgents(value);
    await window.electron?.setIncludeSubAgents?.(value);
  };

  const handleTestSpeech = () => {
    if (isPlayingTest || speakers.length === 0) {
      return;
    }

    setIsPlayingTest(true);
    setTestAudioError("");
    setError("");

    onTestSpeech();
    console.log("[SettingsPanel] Test speech requested");

    setTimeout(() => {
      setIsPlayingTest(false);
    }, 3000);
  };

  const handleReset = async () => {
    if (confirm("Are you sure you want to reset all settings to defaults? This will close the settings panel.")) {
      onResetAllSettings();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      <div
        ref={panelRef}
        className="h-full w-[400px] bg-white/95 backdrop-blur-md shadow-2xl overflow-y-auto pointer-events-auto"
        data-settings-panel
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-800">設定 - cc-mascot</h1>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4L12 12M12 4L4 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Character Section */}
          <section className="rounded-2xl bg-slate-50/60 p-6 shadow-sm">
            <h2 className="m-0 mb-4 text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span>🎨</span> キャラクター
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <label htmlFor="vrm-file" className="text-sm font-medium text-slate-600">
                  VRMモデル変更
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  id="vrm-file"
                  accept=".vrm,.glb"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                <button
                  className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm w-fit"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  VRMファイルを選択
                </button>
                <p className="text-sm text-slate-500 mb-0 italic">
                  {selectedFileName || vrmFileName || "ファイルが選択されていません"}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <label htmlFor="character-size" className="text-sm font-medium text-slate-600">
                  キャラクターサイズ: {containerSize}px
                </label>
                <input
                  type="range"
                  id="character-size"
                  min="400"
                  max="1200"
                  step="10"
                  value={containerSize}
                  onChange={(e) => handleCharacterSizeChange(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
                <div className="flex justify-between text-sm text-slate-400">
                  <span>400px (小)</span>
                  <span>1200px (大)</span>
                </div>
              </div>
            </div>
          </section>

          {/* Audio Section */}
          <section className="rounded-2xl bg-slate-50/60 p-6 shadow-sm">
            <h2 className="m-0 mb-4 text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span>🔊</span> オーディオ
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-slate-600">音声合成エンジン</label>
                <div className="flex flex-col gap-2.5">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-800">
                    <input
                      type="radio"
                      name="engineType"
                      value="aivis"
                      checked={engineType === "aivis"}
                      onChange={() => handleEngineTypeChange("aivis")}
                      className="w-4 h-4 m-0 cursor-pointer accent-primary"
                    />
                    <span className="font-normal">AivisSpeech</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-800">
                    <input
                      type="radio"
                      name="engineType"
                      value="voicevox"
                      checked={engineType === "voicevox"}
                      onChange={() => handleEngineTypeChange("voicevox")}
                      className="w-4 h-4 m-0 cursor-pointer accent-primary"
                    />
                    <span className="font-normal">VOICEVOX</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-800">
                    <input
                      type="radio"
                      name="engineType"
                      value="custom"
                      checked={engineType === "custom"}
                      onChange={() => handleEngineTypeChange("custom")}
                      className="w-4 h-4 m-0 cursor-pointer accent-primary"
                    />
                    <span className="font-normal">カスタム</span>
                  </label>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <label htmlFor="engine-path" className="text-sm font-medium text-slate-600">
                  エンジンパス
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    id="engine-path"
                    value={engineType === "custom" ? customPath : defaultEnginePath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    disabled={engineType !== "custom"}
                    placeholder={engineType === "custom" ? "カスタムエンジンパスを入力" : ""}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                  {engineType === "custom" && (
                    <button
                      type="button"
                      onClick={handleApplyCustomPath}
                      className="btn-gradient px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap min-w-[60px]"
                      disabled={loadingSpeakers}
                    >
                      確定
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <label htmlFor="speaker-select" className="text-sm font-medium text-slate-600">
                  音声スタイル
                </label>
                {loadingSpeakers ? (
                  <>
                    <select
                      id="speaker-select"
                      disabled
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white cursor-pointer w-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      <option>読み込み中...</option>
                    </select>
                    <p className="text-sm text-slate-400 mt-1 mb-0">エンジンの起動を待っています...</p>
                  </>
                ) : speakers.length > 0 ? (
                  <select
                    id="speaker-select"
                    value={speakerId}
                    onChange={(e) => handleSpeakerChange(Number(e.target.value))}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white cursor-pointer w-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    {speakers.map((speaker) => (
                      <option key={speaker.id} value={speaker.id}>
                        {speaker.speakerName} - {speaker.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <select
                      id="speaker-select"
                      disabled
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white cursor-pointer w-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      <option>利用可能なスタイルがありません</option>
                    </select>
                    <p className="text-sm text-slate-400 mt-1 mb-0">エンジンが実行されていますか?</p>
                  </>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <label htmlFor="volume-scale" className="text-sm font-medium text-slate-600">
                  音量: {volumeScale.toFixed(2)}
                </label>
                <input
                  type="range"
                  id="volume-scale"
                  min="0"
                  max="2"
                  step="0.01"
                  value={volumeScale}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  onMouseUp={handleVolumeChangeComplete}
                  onTouchEnd={handleVolumeChangeComplete}
                  className="w-full cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-slate-600">テスト音声</label>
                <button
                  type="button"
                  onClick={handleTestSpeech}
                  disabled={isPlayingTest || speakers.length === 0}
                  className="btn-gradient px-5 py-2 rounded-full text-sm font-medium w-fit"
                >
                  {isPlayingTest ? "再生中..." : "テスト音声を再生"}
                </button>
                {testAudioError && <p className="text-sm text-danger mt-1 mb-0">{testAudioError}</p>}
              </div>
              {error && <p className="text-sm text-danger mt-1 mb-0">{error}</p>}
            </div>
          </section>

          {/* Motion Section */}
          <section className="rounded-2xl bg-slate-50/60 p-6 shadow-sm">
            <h2 className="m-0 mb-4 text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span>🎬</span> モーション
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={enableIdleAnimations}
                    onChange={(e) => onEnableIdleAnimationsChange(e.target.checked)}
                    className="w-4 h-4 m-0 cursor-pointer accent-primary"
                  />
                  <span className="font-normal">待機モーションを有効にする</span>
                </label>
                <p className="text-sm text-slate-400 m-0">待機中にたまにリアクションを取ります</p>
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={enableSpeechAnimations}
                    onChange={(e) => onEnableSpeechAnimationsChange(e.target.checked)}
                    className="w-4 h-4 m-0 cursor-pointer accent-primary"
                  />
                  <span className="font-normal">発話モーションを有効にする</span>
                </label>
                <p className="text-sm text-slate-400 m-0">発話時に感情に合わせたリアクションを取ります</p>
              </div>
            </div>
          </section>

          {/* Advanced Settings Section */}
          <section className="rounded-2xl bg-slate-50/60 p-6 shadow-sm">
            <h2 className="m-0 mb-4 text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span>⚙️</span> 高度な設定
            </h2>
            <div className="space-y-4">
              {micMonitorAvailable && (
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={muteOnMicActive}
                      onChange={(e) => onMuteOnMicActiveChange(e.target.checked)}
                      className="w-4 h-4 m-0 cursor-pointer accent-primary"
                    />
                    <span className="font-normal">マイク使用中はミュートにする</span>
                  </label>
                  <p className="text-sm text-slate-400 m-0">マイク使用中は、キャラクターの発話音声をミュートにします</p>
                </div>
              )}
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={includeSubAgents}
                    onChange={(e) => handleIncludeSubAgentsChange(e.target.checked)}
                    className="w-4 h-4 m-0 cursor-pointer accent-primary"
                  />
                  <span className="font-normal">サブエージェントの発言も含める</span>
                </label>
                <p className="text-sm text-slate-400 m-0">サブエージェントの内容も発話の対象とします</p>
              </div>
            </div>
          </section>

          {/* Reset Section */}
          <section className="rounded-2xl bg-slate-50/60 p-6 shadow-sm">
            <h2 className="m-0 mb-4 text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span>🔄</span> リセット
            </h2>
            <div className="flex flex-col gap-3">
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 border border-slate-200 bg-white text-slate-700 w-fit hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm"
                onClick={onResetCharacterPosition}
                type="button"
              >
                キャラクター位置をリセット
              </button>
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 border border-red-200 bg-red-50 text-red-600 w-fit hover:bg-red-100 hover:border-red-300"
                onClick={handleReset}
                type="button"
              >
                すべての設定をリセット
              </button>
            </div>
          </section>

          {/* Developer Section */}
          <section className="rounded-2xl bg-slate-50/60 p-6 shadow-sm">
            <h2 className="m-0 mb-4 text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span>🛠️</span> デベロッパー
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-slate-600">DevTools</label>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 border border-slate-200 bg-white text-slate-700 w-fit hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm"
                  onClick={() => {
                    window.electron?.openDevTools?.();
                  }}
                >
                  DevTools を開く
                </button>
                <p className="text-sm text-slate-500 m-0">
                  ショートカット:{" "}
                  {navigator.userAgent.includes("Mac") ? "⌘ Command + ⌥ Option + I" : "Ctrl + Shift + I"}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
