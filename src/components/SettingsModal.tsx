import { useState, useEffect, useRef } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  speakerId: number;
  onSpeakerIdChange: (id: number) => void;
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  onVRMFileChange: (file: File) => void;
  currentVRMFileName?: string;
  onReset: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  speakerId,
  onSpeakerIdChange,
  baseUrl,
  onBaseUrlChange,
  onVRMFileChange,
  currentVRMFileName,
  onReset,
}: SettingsModalProps) {
  const [speakerIdInput, setSpeakerIdInput] = useState(String(speakerId));
  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl);
  const [error, setError] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSpeakerIdInput(String(speakerId));
      setBaseUrlInput(baseUrl);
      setSelectedFileName(null);
      setError('');
    }
  }, [isOpen, speakerId, baseUrl]);

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

  const handleSave = () => {
    // Validate Speaker ID
    const parsed = parseInt(speakerIdInput, 10);
    if (isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid positive number for Speaker ID');
      return;
    }

    // Validate Base URL
    const trimmedUrl = baseUrlInput.trim();
    if (!trimmedUrl) {
      setError('Base URL cannot be empty');
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setError('Please enter a valid URL (e.g., http://localhost:50021)');
      return;
    }

    setError('');
    onSpeakerIdChange(parsed);
    onBaseUrlChange(trimmedUrl);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
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
            <h3>Audio</h3>
            <div className="settings-item">
              <label htmlFor="base-url">VOICEVOX Engine URL</label>
              <input
                type="text"
                id="base-url"
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="http://localhost:50021"
              />
            </div>
            <div className="settings-item">
              <label htmlFor="speaker-id">Speaker ID</label>
              <input
                type="number"
                id="speaker-id"
                value={speakerIdInput}
                onChange={(e) => setSpeakerIdInput(e.target.value)}
                onKeyDown={handleKeyDown}
                min="0"
              />
            </div>
            {error && <p className="settings-error">{error}</p>}
          </div>

          <div className="settings-section">
            <h3>About</h3>
            <p className="settings-info">
              VRM Avatar Speech Application
            </p>
          </div>

          <div className="settings-section">
            <h3>Reset</h3>
            <button className="settings-button-danger" onClick={handleReset}>
              Reset All Settings
            </button>
          </div>

          <div className="settings-actions">
            <button className="settings-button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="settings-button-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
