import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
export type EngineType = 'aivis' | 'voicevox' | 'custom';

contextBridge.exposeInMainWorld('electron', {
  onSpeak: (callback: (message: string) => void) => {
    const listener = (_event: unknown, message: string) => {
      callback(message);
    };
    ipcRenderer.on('speak', listener);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('speak', listener);
    };
  },
  getVoicevoxPath: (): Promise<string | undefined> => {
    return ipcRenderer.invoke('get-voicevox-path');
  },
  setVoicevoxPath: (path: string): Promise<boolean> => {
    return ipcRenderer.invoke('set-voicevox-path', path);
  },
  getEngineType: (): Promise<EngineType | undefined> => {
    return ipcRenderer.invoke('get-engine-type');
  },
  setEngineSettings: (engineType: EngineType, customPath?: string): Promise<boolean> => {
    return ipcRenderer.invoke('set-engine-settings', engineType, customPath);
  },
  resetEngineSettings: (): Promise<boolean> => {
    return ipcRenderer.invoke('reset-engine-settings');
  },
});
