import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
export type EngineType = 'aivis' | 'voicevox' | 'custom';

contextBridge.exposeInMainWorld('electron', {
  onSpeak: (callback: (message: string) => void) => {
    ipcRenderer.on('speak', (_event, message: string) => {
      callback(message);
    });
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
});
