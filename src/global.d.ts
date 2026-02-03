export {};

export type EngineType = "aivis" | "voicevox" | "custom";

declare global {
  interface Window {
    electron?: {
      onSpeak: (callback: (message: string) => void) => () => void;
      onVRMChanged: (callback: () => void) => () => void;
      onSpeakerChanged: (callback: (speakerId: number) => void) => () => void;
      onVolumeChanged: (callback: (volumeScale: number) => void) => () => void;
      getVoicevoxPath: () => Promise<string | undefined>;
      setVoicevoxPath: (path: string) => Promise<boolean>;
      getEngineType: () => Promise<EngineType | undefined>;
      setEngineSettings: (engineType: EngineType, customPath?: string) => Promise<boolean>;
      resetEngineSettings: () => Promise<boolean>;
      setIgnoreMouseEvents: (ignore: boolean) => void;
      getCharacterSize: () => Promise<number>;
      setCharacterSize: (size: number) => Promise<number>;
      resetCharacterSize: () => Promise<number>;
      getCharacterPosition: () => Promise<{ x: number; y: number } | undefined>;
      setCharacterPosition: (x: number, y: number) => void;
      resetCharacterPosition: () => Promise<boolean>;
      onCharacterPositionReset: (callback: () => void) => () => void;
      onCharacterSizeChanged: (callback: (size: number) => void) => () => void;
      getScreenSize: () => Promise<{ width: number; height: number }>;
      resetAllSettings: () => Promise<boolean>;
      openSettingsWindow: () => void;
      closeSettingsWindow: () => void;
      notifyVRMChanged: () => void;
      notifySpeakerChanged: (speakerId: number) => void;
      notifyVolumeChanged: (volumeScale: number) => void;
      playTestSpeech: () => void;
      onPlayTestSpeech: (callback: () => void) => () => void;
      getMuteOnMicActive: () => Promise<boolean>;
      setMuteOnMicActive: (value: boolean) => Promise<boolean>;
      getDefaultEnginePath: (engineType: "aivis" | "voicevox") => Promise<string>;
      getMicMonitorAvailable: () => Promise<boolean>;
      getIncludeSubAgents: () => Promise<boolean>;
      setIncludeSubAgents: (value: boolean) => Promise<boolean>;
      onMicActiveChanged: (callback: (active: boolean) => void) => () => void;
      onMuteOnMicActiveChanged: (callback: (value: boolean) => void) => () => void;
      onDevToolsStateChanged: (callback: (isOpen: boolean) => void) => () => void;
      toggleDevTools: (target: "main" | "settings") => Promise<boolean>;
      getDevToolsState: (target: "main" | "settings") => Promise<boolean>;
      onMainDevToolsStateChanged: (callback: (isOpen: boolean) => void) => () => void;
      onSettingsDevToolsStateChanged: (callback: (isOpen: boolean) => void) => () => void;
    };
  }
}
