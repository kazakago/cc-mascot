interface SettingsButtonProps {
  onClick: () => void;
}

export function SettingsButton({ onClick }: SettingsButtonProps) {
  return (
    <button className="settings-button" onClick={onClick} aria-label="Settings">
      <img src="/icons/settings.svg" alt="Settings" width="24" height="24" />
    </button>
  );
}
