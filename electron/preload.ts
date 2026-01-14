import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  onSpeak: (callback: (message: string) => void) => {
    ipcRenderer.on('speak', (_event, message: string) => {
      callback(message);
    });
  },
});
