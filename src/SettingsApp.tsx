import { useState, useEffect, useRef, useCallback } from "react";
import type { EngineType } from "./global";
import { getSpeakers } from "./services/voicevox";
import { saveVRMFile, loadVRMFile, deleteVRMFile } from "./utils/vrmStorage";

const VOICEVOX_BASE_URL = "http://localhost:8564";

interface SpeakerOption {
  id: number;
  name: string;
  speakerName: string;
}

export default function SettingsApp() {
  const [vrmFileName, setVrmFileName] = useState<string | undefined>(undefined);

  const [selectedSpeakerId, setSelectedSpeakerId] = useState(888753760);
  const [volumeScaleInput, setVolumeScaleInput] = useState(1.0);
  const [windowSizeInput, setWindowSizeInput] = useState(800);
  const [engineType, setEngineType] = useState<EngineType>("aivis");
  const [defaultEnginePath, setDefaultEnginePath] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [error, setError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<SpeakerOption[]>([]);
  const [loadingSpeakers, setLoadingSpeakers] = useState(false);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [testAudioError, setTestAudioError] = useState("");
  const [muteOnMicActive, setMuteOnMicActive] = useState(false);
  const [micMonitorAvailable, setMicMonitorAvailable] = useState(false);
  const [includeSubAgents, setIncludeSubAgents] = useState(false);
  const [enableIdleAnimations, setEnableIdleAnimations] = useState(true);
  const [enableSpeechAnimations, setEnableSpeechAnimations] = useState(true);
  const [mainDevToolsOpen, setMainDevToolsOpen] = useState(false);
  const [settingsDevToolsOpen, setSettingsDevToolsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          console.log(`[SettingsApp] Engine not ready, retrying (${retryCount + 1}/${maxRetries})...`);
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

  // Load initial values from localStorage and Electron Store
  useEffect(() => {
    const loadInitialValues = async () => {
      // Load from localStorage
      const storedSpeakerId = localStorage.getItem("speakerId");
      const storedVolumeScale = localStorage.getItem("volumeScale");
      const storedWindowSize = localStorage.getItem("windowSize");

      if (storedSpeakerId) setSelectedSpeakerId(Number(storedSpeakerId));
      if (storedVolumeScale) setVolumeScaleInput(Number(storedVolumeScale));
      if (storedWindowSize) setWindowSizeInput(Number(storedWindowSize));

      // Load from Electron Store
      if (window.electron?.getEngineType && window.electron?.getVoicevoxPath && window.electron?.getCharacterSize) {
        const [savedEngineType, savedCustomPath, savedWindowSize] = await Promise.all([
          window.electron.getEngineType(),
          window.electron.getVoicevoxPath(),
          window.electron.getCharacterSize(),
        ]);
        const effectiveEngineType = savedEngineType || "aivis";
        setEngineType(effectiveEngineType);
        setCustomPath(savedCustomPath || "");
        if (savedWindowSize) {
          setWindowSizeInput(savedWindowSize);
        }

        // Load default engine path for current engine type
        if (effectiveEngineType !== "custom" && window.electron?.getDefaultEnginePath) {
          const path = await window.electron.getDefaultEnginePath(effectiveEngineType);
          setDefaultEnginePath(path);
        }
      }

      // Load mic monitor settings
      if (window.electron?.getMicMonitorAvailable) {
        const available = await window.electron.getMicMonitorAvailable();
        setMicMonitorAvailable(available);
      }
      if (window.electron?.getMuteOnMicActive) {
        const muted = await window.electron.getMuteOnMicActive();
        setMuteOnMicActive(muted);
      }

      // Load sub-agent monitoring settings
      if (window.electron?.getIncludeSubAgents) {
        const include = await window.electron.getIncludeSubAgents();
        setIncludeSubAgents(include);
      }

      // Load motion settings
      if (window.electron?.getEnableIdleAnimations) {
        const idle = await window.electron.getEnableIdleAnimations();
        setEnableIdleAnimations(idle);
      }
      if (window.electron?.getEnableSpeechAnimations) {
        const speech = await window.electron.getEnableSpeechAnimations();
        setEnableSpeechAnimations(speech);
      }

      // Load VRM file name from IndexedDB
      try {
        const vrmFile = await loadVRMFile();
        if (vrmFile) {
          setVrmFileName(vrmFile.name);
        }
      } catch (err) {
        console.error("[SettingsApp] Failed to load VRM file:", err);
      }
    };
    loadInitialValues();
  }, []);

  // Load DevTools state and listen for changes
  useEffect(() => {
    if (window.electron?.getDevToolsState) {
      window.electron.getDevToolsState("main").then(setMainDevToolsOpen);
      window.electron.getDevToolsState("settings").then(setSettingsDevToolsOpen);
    }

    const cleanupMain = window.electron?.onMainDevToolsStateChanged?.((isOpen) => {
      setMainDevToolsOpen(isOpen);
    });
    const cleanupSettings = window.electron?.onSettingsDevToolsStateChanged?.((isOpen) => {
      setSettingsDevToolsOpen(isOpen);
    });

    return () => {
      cleanupMain?.();
      cleanupSettings?.();
    };
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
        console.log(`[SettingsApp] Restarting engine: type=${effectiveEngineType}, path=${effectivePath}`);
        const started = await window.electron.setEngineSettings(effectiveEngineType, effectivePath);

        if (!started) {
          setError("エンジンの起動に失敗しました。エンジンがインストールされているか確認してください。");
          setLoadingSpeakers(false);
          return;
        }

        const newSpeakers = await fetchSpeakers();

        if (newSpeakers.length > 0) {
          const currentExists = newSpeakers.some((s) => s.id === selectedSpeakerId);
          if (!currentExists) {
            const firstSpeakerId = newSpeakers[0].id;
            setSelectedSpeakerId(firstSpeakerId);
            localStorage.setItem("speakerId", String(firstSpeakerId));
            console.log(`[SettingsApp] Auto-selected first speaker: ${firstSpeakerId}`);
            // Notify main window of speaker change
            if (window.electron?.notifySpeakerChanged) {
              window.electron.notifySpeakerChanged(firstSpeakerId);
            }
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

    // Update default engine path display
    if (newEngineType !== "custom" && window.electron?.getDefaultEnginePath) {
      const path = await window.electron.getDefaultEnginePath(newEngineType);
      setDefaultEnginePath(path);
    }

    if (newEngineType === "custom") {
      if (!customPath.trim()) {
        console.log("[SettingsApp] Custom engine selected but path is empty, skipping restart");
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
      // Save to IndexedDB via the existing utility
      saveVRMFile(file)
        .then(() => {
          console.log("[SettingsApp] VRM file saved");
          // Notify main window to reload VRM
          if (window.electron?.notifyVRMChanged) {
            window.electron.notifyVRMChanged();
          }
        })
        .catch((err) => {
          console.error("[SettingsApp] Failed to save VRM file:", err);
          setError("Failed to save VRM file");
        });
      setError("");
    }
  };

  const handleSpeakerChange = (newSpeakerId: number) => {
    setSelectedSpeakerId(newSpeakerId);
    localStorage.setItem("speakerId", String(newSpeakerId));
    console.log(`[SettingsApp] Speaker changed to: ${newSpeakerId}`);
    // Notify main window of speaker change
    if (window.electron?.notifySpeakerChanged) {
      window.electron.notifySpeakerChanged(newSpeakerId);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolumeScaleInput(newVolume);
    // Notify main window immediately for real-time volume update
    if (window.electron?.notifyVolumeChanged) {
      window.electron.notifyVolumeChanged(newVolume);
    }
  };

  const handleMuteOnMicActiveChange = async (value: boolean) => {
    setMuteOnMicActive(value);
    await window.electron?.setMuteOnMicActive?.(value);
  };

  const handleIncludeSubAgentsChange = async (value: boolean) => {
    setIncludeSubAgents(value);
    await window.electron?.setIncludeSubAgents?.(value);
  };

  const handleEnableIdleAnimationsChange = async (value: boolean) => {
    setEnableIdleAnimations(value);
    await window.electron?.setEnableIdleAnimations?.(value);
  };

  const handleEnableSpeechAnimationsChange = async (value: boolean) => {
    setEnableSpeechAnimations(value);
    await window.electron?.setEnableSpeechAnimations?.(value);
  };

  const handleVolumeChangeComplete = () => {
    localStorage.setItem("volumeScale", String(volumeScaleInput));
    console.log(`[SettingsApp] Volume saved to localStorage: ${volumeScaleInput}`);
  };

  const handleWindowSizeChange = (newSize: number) => {
    setWindowSizeInput(newSize);
    localStorage.setItem("windowSize", String(newSize));

    // Fire and forget - don't await to prevent slider value reset during rapid dragging
    window.electron?.setCharacterSize?.(newSize).catch((err: unknown) => {
      console.error("Failed to change window size:", err);
      setError("Failed to change window size");
    });
  };

  const handleTestSpeech = () => {
    if (isPlayingTest || speakers.length === 0) {
      return;
    }

    setIsPlayingTest(true);
    setTestAudioError("");
    setError("");

    // Send IPC message to main window to play test speech with lip sync
    if (window.electron?.playTestSpeech) {
      window.electron.playTestSpeech();
      console.log("[SettingsApp] Test speech requested");

      // Reset playing state after a delay (speech is handled by main window)
      setTimeout(() => {
        setIsPlayingTest(false);
      }, 3000);
    } else {
      setTestAudioError("IPC通信エラー: メインウィンドウに接続できません");
      setIsPlayingTest(false);
    }
  };

  const handleReset = async () => {
    if (confirm("Are you sure you want to reset all settings to defaults? This will close the settings window.")) {
      localStorage.clear();

      // Delete VRM file from IndexedDB
      try {
        await deleteVRMFile();
        console.log("[SettingsApp] VRM file deleted");
        // Update UI state to reflect the deletion
        setVrmFileName(undefined);
        setSelectedFileName(null);
      } catch (err) {
        console.error("[SettingsApp] Failed to delete VRM file:", err);
      }

      if (window.electron?.resetAllSettings) {
        await window.electron.resetAllSettings();
      }

      // Notify main window to reload VRM (will load default)
      if (window.electron?.notifyVRMChanged) {
        window.electron.notifyVRMChanged();
      }

      // Reset speaker to default
      const defaultSpeakerId = 888753760;
      if (window.electron?.notifySpeakerChanged) {
        window.electron.notifySpeakerChanged(defaultSpeakerId);
      }

      // Reset volume to default
      const defaultVolume = 1.0;
      if (window.electron?.notifyVolumeChanged) {
        window.electron.notifyVolumeChanged(defaultVolume);
      }

      // Reset character position
      window.electron?.resetCharacterPosition?.();

      // Reset mic mute setting
      setMuteOnMicActive(false);
      await window.electron?.setMuteOnMicActive?.(false);

      // Reset sub-agent monitoring setting
      setIncludeSubAgents(false);
      await window.electron?.setIncludeSubAgents?.(false);

      // Reset motion settings
      setEnableIdleAnimations(true);
      setEnableSpeechAnimations(true);
      await window.electron?.setEnableIdleAnimations?.(true);
      await window.electron?.setEnableSpeechAnimations?.(true);

      // Close settings window
      if (window.electron?.closeSettingsWindow) {
        window.electron.closeSettingsWindow();
      }
    }
  };

  return (
    <div className="h-screen bg-white p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-5">
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
              <label htmlFor="window-size" className="text-sm font-medium text-slate-600">
                キャラクターサイズ: {windowSizeInput}px
              </label>
              <input
                type="range"
                id="window-size"
                min="400"
                max="1200"
                step="10"
                value={windowSizeInput}
                onChange={(e) => handleWindowSizeChange(Number(e.target.value))}
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
                  value={selectedSpeakerId}
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
                音量: {volumeScaleInput.toFixed(2)}
              </label>
              <input
                type="range"
                id="volume-scale"
                min="0"
                max="2"
                step="0.01"
                value={volumeScaleInput}
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
                  onChange={(e) => handleEnableIdleAnimationsChange(e.target.checked)}
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
                  onChange={(e) => handleEnableSpeechAnimationsChange(e.target.checked)}
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
                    onChange={(e) => handleMuteOnMicActiveChange(e.target.checked)}
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
              onClick={() => {
                window.electron?.resetCharacterPosition?.();
              }}
            >
              キャラクター位置をリセット
            </button>
            <button
              className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 border border-red-200 bg-red-50 text-red-600 w-fit hover:bg-red-100 hover:border-red-300"
              onClick={handleReset}
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
              <div className="flex gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 border border-slate-200 bg-white text-slate-700 w-fit hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm"
                  onClick={() => {
                    window.electron?.toggleDevTools?.("main").then(setMainDevToolsOpen);
                  }}
                >
                  メインウィンドウ DevTools を{mainDevToolsOpen ? "閉じる" : "開く"}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 border border-slate-200 bg-white text-slate-700 w-fit hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm"
                  onClick={() => {
                    window.electron?.toggleDevTools?.("settings").then(setSettingsDevToolsOpen);
                  }}
                >
                  設定ウィンドウ DevTools を{settingsDevToolsOpen ? "閉じる" : "開く"}
                </button>
              </div>
              <p className="text-sm text-slate-500 m-0">
                ショートカット: {navigator.platform.includes("Mac") ? "⌘ Command + ⌥ Option + I" : "Ctrl + Shift + I"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
