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
  const fetchSpeakers = useCallback(async (retryCount = 0, maxRetries = 10) => {
    setLoadingSpeakers(true);
    setError('');
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
        return fetchSpeakers(retryCount + 1, maxRetries);
      } else {
        console.error('Failed to fetch speakers after retries:', err);
        setError('Failed to fetch speakers. Is the engine running?');
        setSpeakers([]);
        setLoadingSpeakers(false);
        return [];
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedSpeakerId(speakerId);
      setVolumeScaleInput(volumeScale);
      setSelectedFileName(null);
      setError('');

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
      fetchSpeakers();
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
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>Settings</h2>
          <button className="settings-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="settings-modal-content">
          <div className="settings-section">
            <h3>Avatar</h3>
            <div className="settings-item">
              <label htmlFor="vrm-file">VRM Model</label>
              <input
                ref={fileInputRef}
                type="file"
                id="vrm-file"
                accept=".vrm,.glb"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <button
                className="settings-file-button"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                Choose VRM File
              </button>
              <p className="settings-file-name">
                {selectedFileName || currentVRMFileName || 'No file selected'}
              </p>
            </div>
          </div>

          <div className="settings-section">
            <h3>Speech Engine</h3>
            <div className="settings-item">
              <label>Engine Type</label>
              <div className="settings-radio-group">
                <label className="settings-radio-label">
                  <input
                    type="radio"
                    name="engineType"
                    value="aivis"
                    checked={engineType === 'aivis'}
                    onChange={() => handleEngineTypeChange('aivis')}
                  />
                  <span>AivisSpeech</span>
                </label>
                <label className="settings-radio-label">
                  <input
                    type="radio"
                    name="engineType"
                    value="voicevox"
                    checked={engineType === 'voicevox'}
                    onChange={() => handleEngineTypeChange('voicevox')}
                  />
                  <span>VOICEVOX</span>
                </label>
                <label className="settings-radio-label">
                  <input
                    type="radio"
                    name="engineType"
                    value="custom"
                    checked={engineType === 'custom'}
                    onChange={() => handleEngineTypeChange('custom')}
                  />
                  <span>Custom</span>
                </label>
              </div>
            </div>
            <div className="settings-item">
              <label htmlFor="engine-path">Engine Path</label>
              <div className="settings-input-with-button">
                <input
                  type="text"
                  id="engine-path"
                  value={engineType === 'custom' ? customPath : ENGINE_PATHS[engineType]}
                  onChange={(e) => setCustomPath(e.target.value)}
                  disabled={engineType !== 'custom'}
                  placeholder={engineType === 'custom' ? 'Enter custom engine path' : ''}
                  className="settings-input-flex"
                />
                {engineType === 'custom' && (
                  <button
                    type="button"
                    onClick={handleApplyCustomPath}
                    className="settings-button-apply"
                    disabled={loadingSpeakers}
                  >
                    確定
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Audio</h3>
            <div className="settings-item">
              <label htmlFor="speaker-select">Speaker</label>
              {loadingSpeakers ? (
                <>
                  <select
                    id="speaker-select"
                    disabled
                    className="settings-select"
                  >
                    <option>Loading speakers...</option>
                  </select>
                  <p className="settings-info-small">Waiting for engine to start...</p>
                </>
              ) : speakers.length > 0 ? (
                <select
                  id="speaker-select"
                  value={selectedSpeakerId}
                  onChange={(e) => handleSpeakerChange(Number(e.target.value))}
                  className="settings-select"
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
                    className="settings-select"
                  >
                    <option>No speakers available</option>
                  </select>
                  <p className="settings-info-small">Is the engine running?</p>
                </>
              )}
            </div>
            <div className="settings-item">
              <label htmlFor="volume-scale">
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
                className="settings-slider"
              />
            </div>
            {error && <p className="settings-error">{error}</p>}
          </div>

          <div className="settings-section">
            <h3>Reset</h3>
            <button className="settings-button-danger" onClick={handleReset}>
              Reset All Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
