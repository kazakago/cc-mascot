import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
export type EngineType = "aivis" | "voicevox" | "custom";

contextBridge.exposeInMainWorld("electron", {
  onSpeak: (callback: (message: string) => void) => {
    const listener = (_event: unknown, message: string) => {
      callback(message);
    };
    ipcRenderer.on("speak", listener);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("speak", listener);
    };
  },
  getVoicevoxPath: (): Promise<string | undefined> => {
    return ipcRenderer.invoke("get-voicevox-path");
  },
  setVoicevoxPath: (path: string): Promise<boolean> => {
    return ipcRenderer.invoke("set-voicevox-path", path);
  },
  getEngineType: (): Promise<EngineType | undefined> => {
    return ipcRenderer.invoke("get-engine-type");
  },
  setEngineSettings: (engineType: EngineType, customPath?: string): Promise<boolean> => {
    return ipcRenderer.invoke("set-engine-settings", engineType, customPath);
  },
  resetEngineSettings: (): Promise<boolean> => {
    return ipcRenderer.invoke("reset-engine-settings");
  },
  setIgnoreMouseEvents: (ignore: boolean): void => {
    ipcRenderer.send("set-ignore-mouse-events", ignore);
  },
  getCharacterSize: (): Promise<number> => {
    return ipcRenderer.invoke("get-character-size");
  },
  setCharacterSize: (size: number): Promise<number> => {
    return ipcRenderer.invoke("set-character-size", size);
  },
  resetCharacterSize: (): Promise<number> => {
    return ipcRenderer.invoke("reset-character-size");
  },
  getCharacterPosition: (): Promise<{ x: number; y: number } | undefined> => {
    return ipcRenderer.invoke("get-character-position");
  },
  setCharacterPosition: (x: number, y: number): void => {
    ipcRenderer.send("set-character-position", x, y);
  },
  resetCharacterPosition: (): Promise<boolean> => {
    return ipcRenderer.invoke("reset-character-position");
  },
  getScreenSize: (): Promise<{ width: number; height: number }> => {
    return ipcRenderer.invoke("get-screen-size");
  },
  resetAllSettings: (): Promise<boolean> => {
    return ipcRenderer.invoke("reset-all-settings");
  },
  getMicActive: (): Promise<boolean> => {
    return ipcRenderer.invoke("get-mic-active");
  },
  getMuteOnMicActive: (): Promise<boolean> => {
    return ipcRenderer.invoke("get-mute-on-mic-active");
  },
  setMuteOnMicActive: (value: boolean): Promise<boolean> => {
    return ipcRenderer.invoke("set-mute-on-mic-active", value);
  },
  getDefaultEnginePath: (engineType: "aivis" | "voicevox"): Promise<string> => {
    return ipcRenderer.invoke("get-default-engine-path", engineType);
  },
  getMicMonitorAvailable: (): Promise<boolean> => {
    return ipcRenderer.invoke("get-mic-monitor-available");
  },
  getIncludeSubAgents: (): Promise<boolean> => {
    return ipcRenderer.invoke("get-include-sub-agents");
  },
  setIncludeSubAgents: (value: boolean): Promise<boolean> => {
    return ipcRenderer.invoke("set-include-sub-agents", value);
  },
  getSpeakerId: (): Promise<number> => {
    return ipcRenderer.invoke("get-speaker-id");
  },
  setSpeakerId: (id: number): Promise<boolean> => {
    return ipcRenderer.invoke("set-speaker-id", id);
  },
  getVolumeScale: (): Promise<number> => {
    return ipcRenderer.invoke("get-volume-scale");
  },
  setVolumeScale: (volume: number): Promise<boolean> => {
    return ipcRenderer.invoke("set-volume-scale", volume);
  },
  getEnableIdleAnimations: (): Promise<boolean> => {
    return ipcRenderer.invoke("get-enable-idle-animations");
  },
  setEnableIdleAnimations: (value: boolean): Promise<boolean> => {
    return ipcRenderer.invoke("set-enable-idle-animations", value);
  },
  getEnableSpeechAnimations: (): Promise<boolean> => {
    return ipcRenderer.invoke("get-enable-speech-animations");
  },
  setEnableSpeechAnimations: (value: boolean): Promise<boolean> => {
    return ipcRenderer.invoke("set-enable-speech-animations", value);
  },
  onMicActiveChanged: (callback: (active: boolean) => void) => {
    const listener = (_event: unknown, active: boolean) => {
      callback(active);
    };
    ipcRenderer.on("mic-active-changed", listener);
    return () => {
      ipcRenderer.removeListener("mic-active-changed", listener);
    };
  },
  onDevToolsStateChanged: (callback: (isOpen: boolean) => void) => {
    const listener = (_event: unknown, isOpen: boolean) => {
      callback(isOpen);
    };
    ipcRenderer.on("devtools-state-changed", listener);
    return () => {
      ipcRenderer.removeListener("devtools-state-changed", listener);
    };
  },
  openDevTools: (): Promise<void> => {
    return ipcRenderer.invoke("open-devtools");
  },
  onToggleSettingsPanel: (callback: () => void) => {
    const listener = () => {
      callback();
    };
    ipcRenderer.on("toggle-settings-panel", listener);
    return () => {
      ipcRenderer.removeListener("toggle-settings-panel", listener);
    };
  },
  getAutoUpdateCheck: (): Promise<boolean> => {
    return ipcRenderer.invoke("get-auto-update-check");
  },
  setAutoUpdateCheck: (value: boolean): Promise<boolean> => {
    return ipcRenderer.invoke("set-auto-update-check", value);
  },
  getAnimationManifest: (): Promise<{
    idle_loop: string;
    idle: string[];
    emotions: Partial<Record<string, string[]>>;
  }> => {
    return ipcRenderer.invoke("get-animation-manifest");
  },
});
