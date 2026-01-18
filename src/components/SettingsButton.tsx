interface SettingsButtonProps {
  onClick: () => void;
}

export function SettingsButton({ onClick }: SettingsButtonProps) {
  return (
    <button
      className="fixed top-5 right-5 w-12 h-12 border-0 rounded-full bg-white/90 text-gray-800 cursor-pointer flex items-center justify-center shadow-md transition-all duration-200 ease-in-out z-[100] hover:bg-white hover:shadow-lg hover:scale-105 active:scale-95"
      onClick={onClick}
      aria-label="Settings"
    >
      <img
        src="/icons/settings.svg"
        alt="Settings"
        width="24"
        height="24"
        className="brightness-0 saturate-100 opacity-80 hover:opacity-100"
      />
    </button>
  );
}
