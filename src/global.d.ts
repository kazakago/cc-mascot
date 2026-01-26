export {};

export type EngineType = "aivis" | "voicevox" | "custom";

declare global {
  interface Window {
    electron?: {
      onSpeak: (callback: (message: string) => void) => () => void;
      onVRMChanged: (callback: () => void) => () => void;
      onSpeakerChanged: (callback: (speakerId: number) => void) => () => void;
      onVolumeChanged: (callback: (volumeScale: number) => void) => () => void;
      onCursorTrackingChanged: (
        callback: (options: {
          enabled: boolean;
          eyeSensitivity: number;
          headSensitivity: number;
          trackingRange: number;
        }) => void,
      ) => () => void;
      getVoicevoxPath: () => Promise<string | undefined>;
      setVoicevoxPath: (path: string) => Promise<boolean>;
      getEngineType: () => Promise<EngineType | undefined>;
      setEngineSettings: (engineType: EngineType, customPath?: string) => Promise<boolean>;
      resetEngineSettings: () => Promise<boolean>;
      setIgnoreMouseEvents: (ignore: boolean) => void;
      getWindowPosition: () => Promise<{ x: number; y: number }>;
      setWindowPosition: (x: number, y: number) => void;
      getWindowSize: () => Promise<number>;
      setWindowSize: (size: number) => Promise<number>;
      resetWindowSize: () => Promise<number>;
      resetAllSettings: () => Promise<boolean>;
      openSettingsWindow: () => void;
      closeSettingsWindow: () => void;
      notifyVRMChanged: () => void;
      notifySpeakerChanged: (speakerId: number) => void;
      notifyVolumeChanged: (volumeScale: number) => void;
      notifyCursorTrackingChanged: (options: {
        enabled: boolean;
        eyeSensitivity: number;
        headSensitivity: number;
        trackingRange: number;
      }) => void;
      playTestSpeech: () => void;
      onPlayTestSpeech: (callback: () => void) => () => void;
      onDevToolsStateChanged: (callback: (isOpen: boolean) => void) => () => void;
    };
  }
}
