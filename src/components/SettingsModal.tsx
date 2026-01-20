import { useState, useEffect, useRef, useCallback } from 'react';
import type { EngineType } from '../global';
import { getSpeakers } from '../services/voicevox';

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

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  speakerId: number;
  onSpeakerIdChange: (id: number) => void;
  volumeScale: number;
  onVolumeScaleChange: (scale: number) => void;
  onVRMFileChange: (file: File) => void;
  currentVRMFileName?: string;
  onReset: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  speakerId,
  onSpeakerIdChange,
  volumeScale,
  onVolumeScaleChange,
  onVRMFileChange,
  currentVRMFileName,
  onReset,
}: SettingsModalProps) {
  const [selectedSpeakerId, setSelectedSpeakerId] = useState(speakerId);
  const [volumeScaleInput, setVolumeScaleInput] = useState(volumeScale);
  const [engineType, setEngineType] = useState<EngineType>('aivis');
  const [customPath, setCustomPath] = useState('');
  const [error, setError] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<SpeakerOption[]>([]);
  const [loadingSpeakers, setLoadingSpeakers] = useState(false);
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
        // Retry if engine is not ready yet
        if (retryCount < maxRetries) {
          console.log(`[SettingsModal] Engine not ready, retrying (${retryCount + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between retries
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

  useEffect(() => {
    if (isOpen) {
      // Use queueMicrotask to avoid setState during render
      queueMicrotask(() => {
        setSelectedSpeakerId(speakerId);
        setVolumeScaleInput(volumeScale);
        setSelectedFileName(null);
        setError('');
      });

      // Load engine settings from Electron store
      if (window.electron?.getEngineType && window.electron?.getVoicevoxPath) {
        Promise.all([
          window.electron.getEngineType(),
          window.electron.getVoicevoxPath(),
        ]).then(([savedEngineType, savedCustomPath]) => {
          setEngineType(savedEngineType || 'aivis');
          setCustomPath(savedCustomPath || '');
        });
      }

      // Fetch speakers when modal opens
      queueMicrotask(() => {
        fetchSpeakers();
      });
    }
  }, [isOpen, speakerId, volumeScale, fetchSpeakers]);

  // Restart engine with current settings
  const restartEngine = async (engineTypeOverride?: EngineType, pathOverride?: string) => {
    setLoadingSpeakers(true);
    setSpeakers([]);
    setError('');

    const effectiveEngineType = engineTypeOverride !== undefined ? engineTypeOverride : engineType;
    const effectivePath = pathOverride !== undefined ? pathOverride : (effectiveEngineType === 'custom' ? customPath.trim() : undefined);

    // Save engine settings and restart engine
    if (window.electron?.setEngineSettings) {
      try {
        console.log(`[SettingsModal] Restarting engine: type=${effectiveEngineType}, path=${effectivePath}`);
        await window.electron.setEngineSettings(
          effectiveEngineType,
          effectivePath
        );

        // Fetch speakers with automatic retry until engine is ready
        const newSpeakers = await fetchSpeakers();

        // Select first speaker if current selection is not available
        if (newSpeakers.length > 0) {
          const currentExists = newSpeakers.some(s => s.id === selectedSpeakerId);
          if (!currentExists) {
            const firstSpeakerId = newSpeakers[0].id;
            setSelectedSpeakerId(firstSpeakerId);
            onSpeakerIdChange(firstSpeakerId); // Apply to parent component immediately
            console.log(`[SettingsModal] Auto-selected first speaker: ${firstSpeakerId}`);
          }
        }
      } catch (err) {
        console.error('Failed to restart engine:', err);
        setError('Failed to restart engine');
        setLoadingSpeakers(false);
      }
    }
  };

  // Handle engine type change - fetch new speakers and reset selection
  const handleEngineTypeChange = async (newEngineType: EngineType) => {
    setEngineType(newEngineType);

    // For custom engine type, only restart if path is not empty
    if (newEngineType === 'custom') {
      if (!customPath.trim()) {
        console.log('[SettingsModal] Custom engine selected but path is empty, skipping restart');
        setSpeakers([]);
        setLoadingSpeakers(false);
        return;
      }
    }

    await restartEngine(newEngineType);
  };

  // Handle custom path apply
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
      onVRMFileChange(file);
      setError('');
    }
  };

  // Handle speaker change - apply immediately
  const handleSpeakerChange = (newSpeakerId: number) => {
    setSelectedSpeakerId(newSpeakerId);
    console.log(`[SettingsModal] Speaker changed to: ${newSpeakerId}`);
    onSpeakerIdChange(newSpeakerId);
  };

  // Handle volume change - apply on mouse/touch release
  const handleVolumeChangeComplete = () => {
    console.log(`[SettingsModal] Volume changed to: ${volumeScaleInput}`);
    onVolumeScaleChange(volumeScaleInput);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to defaults? This will reload the page.')) {
      onReset();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[2000]" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <div className="bg-white rounded-xl w-[90%] max-w-[500px] max-h-[80vh] overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200">
          <h2 className="m-0 text-xl font-semibold text-gray-800">Settings</h2>
          <button
            className="bg-transparent border-0 text-gray-600 cursor-pointer w-8 h-8 flex items-center justify-center rounded transition-all duration-200 hover:bg-gray-100 hover:text-gray-800"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current"
            >
              <path
                d="M15 5L5 15M5 5L15 15"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)] space-y-6">
          <div>
            <h3 className="m-0 mb-4 text-base font-semibold text-gray-800">Avatar</h3>
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
                className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 border border-gray-300 bg-white text-gray-800 hover:bg-gray-100 hover:border-gray-400"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                Choose VRM File
              </button>
              <p className="text-xs text-gray-600 mb-0 italic">
                {selectedFileName || currentVRMFileName || 'No file selected'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="m-0 mb-4 text-base font-semibold text-gray-800">Speech Engine</h3>
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

          <div>
            <h3 className="m-0 mb-4 text-base font-semibold text-gray-800">Audio</h3>
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
                  <p className="text-xs text-gray-400 mt-1 mb-0">Waiting for engine to start...</p>
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
                  <p className="text-xs text-gray-400 mt-1 mb-0">Is the engine running?</p>
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
              />
              </div>
              {error && <p className="text-xs text-danger mt-1 mb-0">{error}</p>}
            </div>
          </div>

          <div>
            <h3 className="m-0 mb-4 text-base font-semibold text-gray-800">Reset</h3>
            <button
              className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 border-0 bg-danger text-white w-full hover:bg-danger-dark"
              onClick={handleReset}
            >
              Reset All Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
