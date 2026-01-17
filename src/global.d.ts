export {};

export type EngineType = 'aivis' | 'voicevox' | 'custom';

declare global {
  interface Window {
    electron?: {
      onSpeak: (callback: (message: string) => void) => (() => void);
      getVoicevoxPath: () => Promise<string | undefined>;
      setVoicevoxPath: (path: string) => Promise<boolean>;
      getEngineType: () => Promise<EngineType | undefined>;
      setEngineSettings: (engineType: EngineType, customPath?: string) => Promise<boolean>;
      resetEngineSettings: () => Promise<boolean>;
    };
  }
}
