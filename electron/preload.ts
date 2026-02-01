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
  onVRMChanged: (callback: () => void) => {
    const listener = () => {
      callback();
    };
    ipcRenderer.on("vrm-changed", listener);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("vrm-changed", listener);
    };
  },
  onSpeakerChanged: (callback: (speakerId: number) => void) => {
    const listener = (_event: unknown, speakerId: number) => {
      callback(speakerId);
    };
    ipcRenderer.on("speaker-changed", listener);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("speaker-changed", listener);
    };
  },
  onVolumeChanged: (callback: (volumeScale: number) => void) => {
    const listener = (_event: unknown, volumeScale: number) => {
      callback(volumeScale);
    };
    ipcRenderer.on("volume-changed", listener);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("volume-changed", listener);
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
  onCharacterPositionReset: (callback: () => void) => {
    const listener = () => {
      callback();
    };
    ipcRenderer.on("character-position-reset", listener);
    return () => {
      ipcRenderer.removeListener("character-position-reset", listener);
    };
  },
  onCharacterSizeChanged: (callback: (size: number) => void) => {
    const listener = (_event: unknown, size: number) => {
      callback(size);
    };
    ipcRenderer.on("character-size-changed", listener);
    return () => {
      ipcRenderer.removeListener("character-size-changed", listener);
    };
  },
  getScreenSize: (): Promise<{ width: number; height: number }> => {
    return ipcRenderer.invoke("get-screen-size");
  },
  resetAllSettings: (): Promise<boolean> => {
    return ipcRenderer.invoke("reset-all-settings");
  },
  openSettingsWindow: (): void => {
    ipcRenderer.send("open-settings-window");
  },
  closeSettingsWindow: (): void => {
    ipcRenderer.send("close-settings-window");
  },
  notifyVRMChanged: (): void => {
    ipcRenderer.send("notify-vrm-changed");
  },
  notifySpeakerChanged: (speakerId: number): void => {
    ipcRenderer.send("notify-speaker-changed", speakerId);
  },
  notifyVolumeChanged: (volumeScale: number): void => {
    ipcRenderer.send("notify-volume-changed", volumeScale);
  },
  playTestSpeech: (): void => {
    ipcRenderer.send("play-test-speech");
  },
  onPlayTestSpeech: (callback: () => void) => {
    const listener = () => {
      callback();
    };
    ipcRenderer.on("play-test-speech", listener);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("play-test-speech", listener);
    };
  },
  onDevToolsStateChanged: (callback: (isOpen: boolean) => void) => {
    const listener = (_event: unknown, isOpen: boolean) => {
      callback(isOpen);
    };
    ipcRenderer.on("devtools-state-changed", listener);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("devtools-state-changed", listener);
    };
  },
});
