import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn, ChildProcess } from "child_process";
import { createLogMonitor } from "./logMonitor";
import net from "net";
import Store from "electron-store";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// リモートデバッグポートを設定（開発モードのみ、アプリ起動前に実行する必要がある）
const isDev = process.env.NODE_ENV === "development" || process.argv.includes("--dev");
if (isDev) {
  app.commandLine.appendSwitch("remote-debugging-port", "9222");
  console.log("🔍 Remote debugging enabled on port 9222");
}

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let logMonitor: { close: () => void } | null = null;
let voicevoxProcess: ChildProcess | null = null;

const VOICEVOX_PORT = 8564;

// Get icon path for Windows and Linux (Mac uses .icns from package.json)
const getIconPath = () => {
  if (process.platform === "darwin") {
    return undefined; // Mac uses .icns from bundle
  }
  const ext = process.platform === "win32" ? ".ico" : ".png";
  return path.join(__dirname, `../resources/icons/icon${ext}`);
};

// Engine type and path constants
type EngineType = "aivis" | "voicevox" | "custom";
const ENGINE_PATHS: Record<Exclude<EngineType, "custom">, string> = {
  aivis: "/Applications/AivisSpeech.app/Contents/Resources/AivisSpeech-Engine/run",
  voicevox: "/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run",
};

// Get the actual engine path based on engine type
function getEnginePath(): string | undefined {
  const engineType = (store.get("engineType") as EngineType | undefined) || "aivis"; // Default to AivisSpeech
  console.log(`[getEnginePath] Engine type: ${engineType}`);
  if (engineType === "custom") {
    const customPath = store.get("voicevoxEnginePath") as string | undefined;
    console.log(`[getEnginePath] Custom path: ${customPath}`);
    return customPath;
  }
  const path = ENGINE_PATHS[engineType];
  console.log(`[getEnginePath] Predefined path for ${engineType}: ${path}`);
  return path;
}

// Check if port is in use
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
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
    console.log("[Engine] Engine path not set, skipping auto-start");
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
    voicevoxProcess = spawn(voicevoxPath, ["--port", String(VOICEVOX_PORT), "--cors_policy_mode", "all"]);

    voicevoxProcess.stdout?.on("data", (data) => {
      console.log(`[VOICEVOX] ${data.toString().trim()}`);
    });

    voicevoxProcess.stderr?.on("data", (data) => {
      console.error(`[VOICEVOX] ${data.toString().trim()}`);
    });

    voicevoxProcess.on("error", (error) => {
      console.error("[VOICEVOX] Failed to start:", error);
      voicevoxProcess = null;
    });

    voicevoxProcess.on("exit", (code) => {
      console.log(`[VOICEVOX] Process exited with code ${code}`);
      voicevoxProcess = null;
    });

    console.log(`[VOICEVOX] Engine started on port ${VOICEVOX_PORT}`);
  } catch (error) {
    console.error("[VOICEVOX] Error starting engine:", error);
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
    console.log("[Engine] Stopping engine...");
    const proc = voicevoxProcess;
    voicevoxProcess = null;

    // Try graceful shutdown first
    proc.kill("SIGTERM");

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log("[Engine] Force killing engine...");
        proc.kill("SIGKILL");
        resolve();
      }, 5000);

      proc.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Wait for port to be released
    console.log("[Engine] Waiting for port to be released...");
    const released = await waitForPortRelease(VOICEVOX_PORT);
    if (!released) {
      console.warn("[Engine] Port was not released in time");
    }
  }
}

const createWindow = () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: workX, y: workY, width: workW, height: workH } = primaryDisplay.bounds;

  mainWindow = new BrowserWindow({
    width: workW,
    height: workH,
    x: workX,
    y: workY,
    icon: getIconPath(),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    enableLargerThanScreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  // 初期状態ではマウスイベントを受け取る（ドラッグ可能にするため）
  // forward: trueを指定してマウス移動イベントを常に受信
  mainWindow.setIgnoreMouseEvents(false, { forward: true });
  mainWindow.setAlwaysOnTop(true, "pop-up-menu");

  // Force position to cover menu bar area on macOS
  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setBounds({ x: workX, y: workY, width: workW, height: workH });
    }
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Resize window when display metrics change
  screen.on("display-metrics-changed", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const { x, y, width, height } = screen.getPrimaryDisplay().bounds;
      mainWindow.setSize(width, height);
      mainWindow.setPosition(x, y);
    }
  });

  // Wait for the window to be ready before starting log monitor
  mainWindow.webContents.on("did-finish-load", () => {
    // Initialize log monitor with IPC broadcast function
    const broadcast = (message: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("speak", message);
      }
    };

    logMonitor = createLogMonitor(broadcast);
  });

  // Disable always-on-top when DevTools is opened to allow switching to other apps
  mainWindow.webContents.on("devtools-opened", () => {
    console.log("[Main] DevTools opened, disabling always-on-top and resizing to avoid menu bar");
    mainWindow?.setAlwaysOnTop(false);
    mainWindow?.webContents.send("devtools-state-changed", true);

    // Resize window to avoid menu bar area on macOS
    if (mainWindow && !mainWindow.isDestroyed()) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { x, y, width, height } = primaryDisplay.workArea;
      mainWindow.setBounds({ x, y, width, height });
      console.log(`[Main] Window resized to workArea: ${width}x${height} at (${x}, ${y})`);
    }
  });

  mainWindow.webContents.on("devtools-closed", () => {
    console.log("[Main] DevTools closed, enabling always-on-top and resizing to full screen");
    mainWindow?.setAlwaysOnTop(true, "pop-up-menu");
    mainWindow?.webContents.send("devtools-state-changed", false);

    // Resize window to cover menu bar area on macOS
    if (mainWindow && !mainWindow.isDestroyed()) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { x, y, width, height } = primaryDisplay.bounds;
      mainWindow.setBounds({ x, y, width, height });
      console.log(`[Main] Window resized to bounds: ${width}x${height} at (${x}, ${y})`);
    }
  });
};

// Create settings window
const createSettingsWindow = () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    // If settings window already exists, focus it
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 700,
    icon: getIconPath(),
    frame: true,
    transparent: false,
    alwaysOnTop: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    hasShadow: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  settingsWindow.setAlwaysOnTop(true, "pop-up-menu", 1);

  // Load the settings app
  if (process.env.VITE_DEV_SERVER_URL) {
    // In development, load the settings.html from the dev server
    const url = process.env.VITE_DEV_SERVER_URL.replace(/\/$/, "");
    settingsWindow.loadURL(`${url}/settings.html`);
  } else {
    // In production, load the built settings.html
    settingsWindow.loadFile(path.join(__dirname, "../dist/settings.html"));
  }

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  // Open DevTools in development
  if (process.env.VITE_DEV_SERVER_URL) {
    // mainWindow?.webContents.openDevTools();
    // settingsWindow.webContents.openDevTools();
  }
};

// IPC handlers
ipcMain.handle("get-voicevox-path", () => {
  return store.get("voicevoxEnginePath") as string | undefined;
});

ipcMain.handle("set-voicevox-path", async (_event, path: string) => {
  store.set("voicevoxEnginePath", path);
  // Restart engine if it's running
  await stopVoicevoxEngine();
  await startVoicevoxEngine();
  return true;
});

ipcMain.handle("get-engine-type", () => {
  return (store.get("engineType") as EngineType | undefined) || "aivis";
});

ipcMain.handle("set-engine-settings", async (_event, engineType: EngineType, customPath?: string) => {
  console.log(`[IPC] set-engine-settings called: engineType=${engineType}, customPath=${customPath}`);
  store.set("engineType", engineType);
  if (engineType === "custom" && customPath) {
    store.set("voicevoxEnginePath", customPath);
  }
  console.log(`[IPC] Stored engineType: ${store.get("engineType")}`);
  // Restart engine
  await stopVoicevoxEngine();
  await startVoicevoxEngine();
  return true;
});

ipcMain.handle("reset-engine-settings", async () => {
  console.log("[IPC] reset-engine-settings called");
  store.delete("engineType");
  store.delete("voicevoxEnginePath");
  // Stop engine and restart with default settings (AivisSpeech)
  await stopVoicevoxEngine();
  await startVoicevoxEngine();
  return true;
});

// Get current character size from Electron Store
ipcMain.handle("get-character-size", () => {
  return (store.get("characterSize") as number) || 800;
});

// Debounce timers for disk persistence during rapid slider/drag events
let characterSizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let characterPositionDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Set character size with validation
ipcMain.handle("set-character-size", (_event, size: number) => {
  const clampedSize = Math.max(400, Math.min(1200, Math.round(size)));

  // Notify renderer immediately (before any disk I/O)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("character-size-changed", clampedSize);
  }

  // Debounce disk persistence to avoid blocking main process during rapid slider events
  if (characterSizeDebounceTimer) clearTimeout(characterSizeDebounceTimer);
  characterSizeDebounceTimer = setTimeout(() => {
    store.set("characterSize", clampedSize);
  }, 300);

  return clampedSize;
});

// Reset character size to default
ipcMain.handle("reset-character-size", () => {
  const defaultSize = 800;
  store.delete("characterSize");

  // Notify renderer of size change
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("character-size-changed", defaultSize);
  }

  return defaultSize;
});

// Character position persistence
ipcMain.handle("get-character-position", () => {
  return store.get("characterPosition") as { x: number; y: number } | undefined;
});

ipcMain.on("set-character-position", (_event, x: number, y: number) => {
  // Debounce disk persistence to avoid blocking main process during rapid events
  if (characterPositionDebounceTimer) clearTimeout(characterPositionDebounceTimer);
  characterPositionDebounceTimer = setTimeout(() => {
    store.set("characterPosition", { x, y });
  }, 300);
});

// Screen size
ipcMain.handle("get-screen-size", () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;
  return { width, height };
});

// Reset all settings (including character size and position)
ipcMain.handle("reset-all-settings", async () => {
  store.delete("engineType");
  store.delete("voicevoxEnginePath");
  store.delete("characterSize");
  store.delete("characterPosition");

  await stopVoicevoxEngine();
  await startVoicevoxEngine();

  // Notify renderer of size reset
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("character-size-changed", 800);
  }

  return true;
});

// Open settings window
ipcMain.on("open-settings-window", () => {
  createSettingsWindow();
});

// Close settings window
ipcMain.on("close-settings-window", () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
});

// Notify main window that VRM file has changed
ipcMain.on("notify-vrm-changed", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log("[IPC] Notifying main window of VRM change");
    mainWindow.webContents.send("vrm-changed");
  }
});

// Notify main window that speaker has changed
ipcMain.on("notify-speaker-changed", (_event, speakerId: number) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log("[IPC] Notifying main window of speaker change:", speakerId);
    mainWindow.webContents.send("speaker-changed", speakerId);
  }
});

// Notify main window that volume has changed
ipcMain.on("notify-volume-changed", (_event, volumeScale: number) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log("[IPC] Notifying main window of volume change:", volumeScale);
    mainWindow.webContents.send("volume-changed", volumeScale);
  }
});

// Play test speech on main window
ipcMain.on("play-test-speech", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log("[IPC] Playing test speech on main window");
    mainWindow.webContents.send("play-test-speech");
  }
});

ipcMain.on("set-ignore-mouse-events", (_event, ignore: boolean) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Always use forward: true to keep receiving mouse move events even when ignoring clicks
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
    console.log("[IPC] setIgnoreMouseEvents:", ignore, "forward: true");
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // Start VOICEVOX Engine first
  await startVoicevoxEngine();

  createWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Clean up on quit
let isQuitting = false;
app.on("before-quit", async (event) => {
  if (isQuitting) return;

  isQuitting = true;
  event.preventDefault();

  if (logMonitor) {
    logMonitor.close();
  }
  await stopVoicevoxEngine();

  app.quit();
});
