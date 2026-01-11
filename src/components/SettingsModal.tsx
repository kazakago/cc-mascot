import { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  speakerId: number;
  onSpeakerIdChange: (id: number) => void;
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  speakerId,
  onSpeakerIdChange,
  baseUrl,
  onBaseUrlChange
}: SettingsModalProps) {
  const [speakerIdInput, setSpeakerIdInput] = useState(String(speakerId));
  const [baseUrlInput, setBaseUrlInput] = useState(baseUrl);
  const [error, setError] = useState('');

  useEffect(() => {
    setSpeakerIdInput(String(speakerId));
    setBaseUrlInput(baseUrl);
  }, [speakerId, baseUrl]);

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
            <h3>Audio</h3>
            <div className="settings-item">
              <label htmlFor="base-url">AivisSpeech Engine URL</label>
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
