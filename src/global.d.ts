export {};

export type EngineType = "aivis" | "voicevox" | "custom";

declare global {
  interface Window {
    electron?: {
      onSpeak: (callback: (message: string) => void) => () => void;
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
      getScreenSize: () => Promise<{ width: number; height: number }>;
      resetAllSettings: () => Promise<boolean>;
      getMicActive: () => Promise<boolean>;
      getMuteOnMicActive: () => Promise<boolean>;
      setMuteOnMicActive: (value: boolean) => Promise<boolean>;
      getDefaultEnginePath: (engineType: "aivis" | "voicevox") => Promise<string>;
      getMicMonitorAvailable: () => Promise<boolean>;
      getIncludeSubAgents: () => Promise<boolean>;
      setIncludeSubAgents: (value: boolean) => Promise<boolean>;
      getEnableIdleAnimations: () => Promise<boolean>;
      setEnableIdleAnimations: (value: boolean) => Promise<boolean>;
      getEnableSpeechAnimations: () => Promise<boolean>;
      setEnableSpeechAnimations: (value: boolean) => Promise<boolean>;
      onMicActiveChanged: (callback: (active: boolean) => void) => () => void;
      onDevToolsStateChanged: (callback: (isOpen: boolean) => void) => () => void;
      openDevTools: () => Promise<void>;
      onToggleSettingsPanel: (callback: () => void) => () => void;
    };
  }
}
