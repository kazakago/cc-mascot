import { useState, useEffect, useRef, useCallback } from 'react';
import type { EngineType } from './global';
import { getSpeakers } from './services/voicevox';
import { saveVRMFile, loadVRMFile } from './utils/vrmStorage';

const ENGINE_PATHS = {
  aivis: '/Applications/AivisSpeech.app/Contents/Resources/AivisSpeech-Engine/run',
  voicevox: '/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run',
} as const;

const VOICEVOX_BASE_URL = 'http://localhost:8564';

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
  const [engineType, setEngineType] = useState<EngineType>('aivis');
  const [customPath, setCustomPath] = useState('');
  const [error, setError] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<SpeakerOption[]>([]);
  const [loadingSpeakers, setLoadingSpeakers] = useState(false);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [testAudioError, setTestAudioError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch speakers from engine with retry logic
  const fetchSpeakers = useCallback(async (maxRetries = 10) => {
    setLoadingSpeakers(true);
    setError('');

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
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.error('Failed to fetch speakers after retries:', err);
          setError('Failed to fetch speakers. Is the engine running?');
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
      const storedSpeakerId = localStorage.getItem('speakerId');
      const storedVolumeScale = localStorage.getItem('volumeScale');
      const storedWindowSize = localStorage.getItem('windowSize');

      if (storedSpeakerId) setSelectedSpeakerId(Number(storedSpeakerId));
      if (storedVolumeScale) setVolumeScaleInput(Number(storedVolumeScale));
      if (storedWindowSize) setWindowSizeInput(Number(storedWindowSize));

      // Load from Electron Store
      if (window.electron?.getEngineType && window.electron?.getVoicevoxPath && window.electron?.getWindowSize) {
        const [savedEngineType, savedCustomPath, savedWindowSize] = await Promise.all([
          window.electron.getEngineType(),
          window.electron.getVoicevoxPath(),
          window.electron.getWindowSize(),
        ]);
        setEngineType(savedEngineType || 'aivis');
        setCustomPath(savedCustomPath || '');
        if (savedWindowSize) {
          setWindowSizeInput(savedWindowSize);
        }
      }

      // Load VRM file name from IndexedDB
      try {
        const vrmFile = await loadVRMFile();
        if (vrmFile) {
          setVrmFileName(vrmFile.name);
        }
      } catch (err) {
        console.error('[SettingsApp] Failed to load VRM file:', err);
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
    setError('');

    const effectiveEngineType = engineTypeOverride !== undefined ? engineTypeOverride : engineType;
    const effectivePath = pathOverride !== undefined ? pathOverride : (effectiveEngineType === 'custom' ? customPath.trim() : undefined);

    if (window.electron?.setEngineSettings) {
      try {
        console.log(`[SettingsApp] Restarting engine: type=${effectiveEngineType}, path=${effectivePath}`);
        await window.electron.setEngineSettings(
          effectiveEngineType,
          effectivePath
        );

        const newSpeakers = await fetchSpeakers();

        if (newSpeakers.length > 0) {
          const currentExists = newSpeakers.some(s => s.id === selectedSpeakerId);
          if (!currentExists) {
            const firstSpeakerId = newSpeakers[0].id;
            setSelectedSpeakerId(firstSpeakerId);
            localStorage.setItem('speakerId', String(firstSpeakerId));
            console.log(`[SettingsApp] Auto-selected first speaker: ${firstSpeakerId}`);
            // Notify main window of speaker change
            if (window.electron?.notifySpeakerChanged) {
              window.electron.notifySpeakerChanged(firstSpeakerId);
            }
          }
        }
      } catch (err) {
        console.error('Failed to restart engine:', err);
        setError('Failed to restart engine');
        setLoadingSpeakers(false);
      }
    }
  };

  const handleEngineTypeChange = async (newEngineType: EngineType) => {
    setEngineType(newEngineType);

    if (newEngineType === 'custom') {
      if (!customPath.trim()) {
        console.log('[SettingsApp] Custom engine selected but path is empty, skipping restart');
        setSpeakers([]);
        setLoadingSpeakers(false);
        return;
      }
    }

    await restartEngine(newEngineType);
  };

  const handleApplyCustomPath = async () => {
    if (!customPath.trim()) {
      setError('Please enter a custom engine path');
      return;
    }
    await restartEngine('custom', customPath.trim());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.vrm')) {
        setError('Please select a VRM (.vrm or .glb) file');
        return;
      }
      setSelectedFileName(file.name);
      setVrmFileName(file.name);
      // Save to IndexedDB via the existing utility
      saveVRMFile(file).then(() => {
        console.log('[SettingsApp] VRM file saved');
        // Notify main window to reload VRM
        if (window.electron?.notifyVRMChanged) {
          window.electron.notifyVRMChanged();
        }
      }).catch((err) => {
        console.error('[SettingsApp] Failed to save VRM file:', err);
        setError('Failed to save VRM file');
      });
      setError('');
    }
  };

  const handleSpeakerChange = (newSpeakerId: number) => {
    setSelectedSpeakerId(newSpeakerId);
    localStorage.setItem('speakerId', String(newSpeakerId));
    console.log(`[SettingsApp] Speaker changed to: ${newSpeakerId}`);
    // Notify main window of speaker change
    if (window.electron?.notifySpeakerChanged) {
      window.electron.notifySpeakerChanged(newSpeakerId);
    }
  };

  const handleVolumeChangeComplete = () => {
    localStorage.setItem('volumeScale', String(volumeScaleInput));
    console.log(`[SettingsApp] Volume changed to: ${volumeScaleInput}`);
  };

  const handleWindowSizeChange = async (newSize: number) => {
    setWindowSizeInput(newSize);

    if (window.electron?.setWindowSize) {
      try {
        const clampedSize = await window.electron.setWindowSize(newSize);
        setWindowSizeInput(clampedSize);
        localStorage.setItem('windowSize', String(clampedSize));
        console.log(`[SettingsApp] Window size changed to: ${clampedSize}`);
      } catch (err) {
        console.error('Failed to change window size:', err);
        setError('Failed to change window size');
      }
    }
  };

  const handleTestSpeech = () => {
    if (isPlayingTest || speakers.length === 0) {
      return;
    }

    setIsPlayingTest(true);
    setTestAudioError('');
    setError('');

    // Send IPC message to main window to play test speech with lip sync
    if (window.electron?.playTestSpeech) {
      window.electron.playTestSpeech();
      console.log('[SettingsApp] Test speech requested');

      // Reset playing state after a delay (speech is handled by main window)
      setTimeout(() => {
        setIsPlayingTest(false);
      }, 3000);
    } else {
      setTestAudioError('IPC通信エラー: メインウィンドウに接続できません');
      setIsPlayingTest(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all settings to defaults? This will close the settings window.')) {
      localStorage.clear();
      if (window.electron?.resetAllSettings) {
        await window.electron.resetAllSettings();
      }
      // Close settings window
      if (window.electron?.closeSettingsWindow) {
        window.electron.closeSettingsWindow();
      }
    }
  };

  return (
    <div className="h-screen bg-gray-50 p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Avatar Section */}
        <div>
          <h2 className="m-0 mb-4 text-lg font-semibold text-gray-800">Avatar</h2>
          <div className="flex flex-col gap-3">
            <label htmlFor="vrm-file" className="text-sm font-medium text-gray-600">VRM Model</label>
            <input
              ref={fileInputRef}
              type="file"
              id="vrm-file"
              accept=".vrm,.glb"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 hover:border-gray-400 w-fit"
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Choose VRM File
            </button>
            <p className="text-sm text-gray-600 mb-0 italic">
              {selectedFileName || vrmFileName || 'No file selected'}
            </p>
          </div>
        </div>

        {/* Speech Engine Section */}
        <div>
          <h2 className="m-0 mb-4 text-lg font-semibold text-gray-800">Speech Engine</h2>
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-gray-600">Engine Type</label>
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-800">
                  <input
                    type="radio"
                    name="engineType"
                    value="aivis"
                    checked={engineType === 'aivis'}
                    onChange={() => handleEngineTypeChange('aivis')}
                    className="w-4 h-4 m-0 cursor-pointer accent-primary"
                  />
                  <span className="font-normal">AivisSpeech</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-800">
                  <input
                    type="radio"
                    name="engineType"
                    value="voicevox"
                    checked={engineType === 'voicevox'}
                    onChange={() => handleEngineTypeChange('voicevox')}
                    className="w-4 h-4 m-0 cursor-pointer accent-primary"
                  />
                  <span className="font-normal">VOICEVOX</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-800">
                  <input
                    type="radio"
                    name="engineType"
                    value="custom"
                    checked={engineType === 'custom'}
                    onChange={() => handleEngineTypeChange('custom')}
                    className="w-4 h-4 m-0 cursor-pointer accent-primary"
                  />
                  <span className="font-normal">Custom</span>
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <label htmlFor="engine-path" className="text-sm font-medium text-gray-600">Engine Path</label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  id="engine-path"
                  value={engineType === 'custom' ? customPath : ENGINE_PATHS[engineType]}
                  onChange={(e) => setCustomPath(e.target.value)}
                  disabled={engineType !== 'custom'}
                  placeholder={engineType === 'custom' ? 'Enter custom engine path' : ''}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono text-gray-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                />
                {engineType === 'custom' && (
                  <button
                    type="button"
                    onClick={handleApplyCustomPath}
                    className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 border-0 bg-primary text-white whitespace-nowrap min-w-[60px] hover:bg-primary-dark disabled:bg-gray-400 disabled:cursor-not-allowed"
                    disabled={loadingSpeakers}
                  >
                    確定
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Audio Section */}
        <div>
          <h2 className="m-0 mb-4 text-lg font-semibold text-gray-800">Audio</h2>
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <label htmlFor="speaker-select" className="text-sm font-medium text-gray-600">Speaker</label>
              {loadingSpeakers ? (
                <>
                  <select
                    id="speaker-select"
                    disabled
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 bg-white cursor-pointer w-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <option>Loading speakers...</option>
                  </select>
                  <p className="text-sm text-gray-400 mt-1 mb-0">Waiting for engine to start...</p>
                </>
              ) : speakers.length > 0 ? (
                <select
                  id="speaker-select"
                  value={selectedSpeakerId}
                  onChange={(e) => handleSpeakerChange(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 bg-white cursor-pointer w-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
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
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800 bg-white cursor-pointer w-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    <option>No speakers available</option>
                  </select>
                  <p className="text-sm text-gray-400 mt-1 mb-0">Is the engine running?</p>
                </>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <label htmlFor="volume-scale" className="text-sm font-medium text-gray-600">
                Volume Scale: {volumeScaleInput.toFixed(2)}
              </label>
              <input
                type="range"
                id="volume-scale"
                min="0"
                max="2"
                step="0.01"
                value={volumeScaleInput}
                onChange={(e) => setVolumeScaleInput(parseFloat(e.target.value))}
                onMouseUp={handleVolumeChangeComplete}
                onTouchEnd={handleVolumeChangeComplete}
                className="w-full cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-gray-600">Test Speech</label>
              <button
                type="button"
                onClick={handleTestSpeech}
                disabled={isPlayingTest || speakers.length === 0}
                className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 border-0 bg-primary text-white w-fit hover:bg-primary-dark disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isPlayingTest ? '再生中...' : 'テスト音声を再生'}
              </button>
              {testAudioError && <p className="text-sm text-danger mt-1 mb-0">{testAudioError}</p>}
            </div>
            {error && <p className="text-sm text-danger mt-1 mb-0">{error}</p>}
          </div>
        </div>

        {/* Window Section */}
        <div>
          <h2 className="m-0 mb-4 text-lg font-semibold text-gray-800">Window</h2>
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <label htmlFor="window-size" className="text-sm font-medium text-gray-600">
                Window Size: {windowSizeInput}px
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
              <div className="flex justify-between text-sm text-gray-400">
                <span>400px (small)</span>
                <span>1200px (large)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reset Section */}
        <div>
          <h2 className="m-0 mb-4 text-lg font-semibold text-gray-800">Reset</h2>
          <button
            className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 border-0 bg-danger text-white w-fit hover:bg-danger-dark"
            onClick={handleReset}
          >
            Reset All Settings
          </button>
        </div>
      </div>
    </div>
  );
}
