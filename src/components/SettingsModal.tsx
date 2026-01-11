interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
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
              <label htmlFor="speaker-id">Speaker ID</label>
              <input
                type="text"
                id="speaker-id"
                defaultValue="888753760"
                readOnly
                disabled
              />
            </div>
          </div>

          <div className="settings-section">
            <h3>About</h3>
            <p className="settings-info">
              VRM Avatar Speech Application
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
