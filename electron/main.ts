import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import { createLogMonitor } from './logMonitor';
import net from 'net';
import Store from 'electron-store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let logMonitor: { close: () => void } | null = null;
let voicevoxProcess: ChildProcess | null = null;

const VOICEVOX_PORT = 8564;

// Engine type and path constants
type EngineType = 'aivis' | 'voicevox' | 'custom';
const ENGINE_PATHS: Record<Exclude<EngineType, 'custom'>, string> = {
  aivis: '/Applications/AivisSpeech.app/Contents/Resources/AivisSpeech-Engine/run',
  voicevox: '/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run',
};

// Get the actual engine path based on engine type
function getEnginePath(): string | undefined {
  const engineType = store.get('engineType') as EngineType | undefined;
  if (!engineType) {
    return undefined;
  }
  if (engineType === 'custom') {
    return store.get('voicevoxEnginePath') as string | undefined;
  }
  return ENGINE_PATHS[engineType];
}

// Check if port is in use
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

// Start VOICEVOX Engine
async function startVoicevoxEngine(): Promise<void> {
  const voicevoxPath = getEnginePath();

  if (!voicevoxPath) {
    console.log('[Engine] Engine path not set, skipping auto-start');
    return;
  }

  // Check if port is already in use
  const portInUse = await isPortInUse(VOICEVOX_PORT);
  if (portInUse) {
    console.log(`[VOICEVOX] Port ${VOICEVOX_PORT} is already in use, skipping auto-start`);
    return;
  }

  try {
    console.log(`[VOICEVOX] Starting engine at: ${voicevoxPath}`);
    voicevoxProcess = spawn(voicevoxPath, [
      '--port',
      String(VOICEVOX_PORT),
      '--cors_policy_mode',
      'all',
    ]);

    voicevoxProcess.stdout?.on('data', (data) => {
      console.log(`[VOICEVOX] ${data.toString().trim()}`);
    });

    voicevoxProcess.stderr?.on('data', (data) => {
      console.error(`[VOICEVOX] ${data.toString().trim()}`);
    });

    voicevoxProcess.on('error', (error) => {
      console.error('[VOICEVOX] Failed to start:', error);
      voicevoxProcess = null;
    });

    voicevoxProcess.on('exit', (code) => {
      console.log(`[VOICEVOX] Process exited with code ${code}`);
      voicevoxProcess = null;
    });

    console.log(`[VOICEVOX] Engine started on port ${VOICEVOX_PORT}`);
  } catch (error) {
    console.error('[VOICEVOX] Error starting engine:', error);
    voicevoxProcess = null;
  }
}

// Wait for port to be released
async function waitForPortRelease(port: number, maxAttempts: number = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

// Stop VOICEVOX Engine
async function stopVoicevoxEngine(): Promise<void> {
  if (voicevoxProcess) {
    console.log('[Engine] Stopping engine...');
    const proc = voicevoxProcess;
    voicevoxProcess = null;

    // Try graceful shutdown first
    proc.kill('SIGTERM');

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[Engine] Force killing engine...');
        proc.kill('SIGKILL');
        resolve();
      }, 5000);

      proc.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Wait for port to be released
    console.log('[Engine] Waiting for port to be released...');
    const released = await waitForPortRelease(VOICEVOX_PORT);
    if (!released) {
      console.warn('[Engine] Port was not released in time');
    }
  }
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Wait for the window to be ready before starting log monitor
  mainWindow.webContents.on('did-finish-load', () => {
    // Initialize log monitor with IPC broadcast function
    const broadcast = (message: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('speak', message);
      }
    };

    logMonitor = createLogMonitor(broadcast);
  });
};

// IPC handlers
ipcMain.handle('get-voicevox-path', () => {
  return store.get('voicevoxEnginePath') as string | undefined;
});

ipcMain.handle('set-voicevox-path', async (_event, path: string) => {
  store.set('voicevoxEnginePath', path);
  // Restart engine if it's running
  await stopVoicevoxEngine();
  await startVoicevoxEngine();
  return true;
});

ipcMain.handle('get-engine-type', () => {
  return store.get('engineType') as EngineType | undefined;
});

ipcMain.handle('set-engine-settings', async (_event, engineType: EngineType, customPath?: string) => {
  store.set('engineType', engineType);
  if (engineType === 'custom' && customPath) {
    store.set('voicevoxEnginePath', customPath);
  }
  // Restart engine
  await stopVoicevoxEngine();
  await startVoicevoxEngine();
  return true;
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // Start VOICEVOX Engine first
  await startVoicevoxEngine();

  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up on quit
let isQuitting = false;
app.on('before-quit', async (event) => {
  if (isQuitting) return;

  isQuitting = true;
  event.preventDefault();

  if (logMonitor) {
    logMonitor.close();
  }
  await stopVoicevoxEngine();

  app.quit();
});
