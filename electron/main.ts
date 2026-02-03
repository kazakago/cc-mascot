import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, shell, Tray } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn, execSync, ChildProcess } from "child_process";
import { createLogMonitor } from "./logMonitor";
import fs from "fs";
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
let licenseWindow: BrowserWindow | null = null;
let logMonitor: { close: () => void } | null = null;
let voicevoxProcess: ChildProcess | null = null;
let micMonitorProcess: ChildProcess | null = null;
let micActive = false;
let tray: Tray | null = null;

const VOICEVOX_PORT = 8564;

// Start or restart log monitor with current settings
function startLogMonitor(): void {
  // Close existing monitor if any
  if (logMonitor) {
    logMonitor.close();
    logMonitor = null;
  }

  // Initialize log monitor with IPC broadcast function
  const broadcast = (message: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("speak", message);
    }
  };

  const includeSubAgents = (store.get("includeSubAgents") as boolean | undefined) ?? false;
  console.log(`[LogMonitor] Starting with includeSubAgents=${includeSubAgents}`);
  logMonitor = createLogMonitor(broadcast, includeSubAgents);
}

// Get mic-monitor binary path
function getMicMonitorPath(): string | undefined {
  if (process.platform !== "darwin") return undefined;

  const devPath = path.join(__dirname, "../resources/mic-monitor");
  if (app.isPackaged) {
    const prodPath = path.join(process.resourcesPath, "mic-monitor");
    return fs.existsSync(prodPath) ? prodPath : undefined;
  }
  return fs.existsSync(devPath) ? devPath : undefined;
}

// Start mic-monitor helper process
function startMicMonitor(): void {
  if (micMonitorProcess) return;

  const monitorPath = getMicMonitorPath();
  if (!monitorPath) {
    console.log("[MicMonitor] Binary not found, feature disabled");
    return;
  }

  try {
    console.log(`[MicMonitor] Starting: ${monitorPath}`);
    micMonitorProcess = spawn(monitorPath);

    let buffer = "";
    micMonitorProcess.stdout?.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line) as { micActive: boolean };
          micActive = parsed.micActive;
          console.log(`[MicMonitor] Mic active: ${micActive}`);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("mic-active-changed", micActive);
          }
        } catch {
          console.warn("[MicMonitor] Failed to parse:", line);
        }
      }
    });

    micMonitorProcess.stderr?.on("data", (data) => {
      console.error(`[MicMonitor] ${data.toString().trim()}`);
    });

    micMonitorProcess.on("error", (error) => {
      console.error("[MicMonitor] Failed to start:", error);
      micMonitorProcess = null;
    });

    micMonitorProcess.on("exit", (code) => {
      console.log(`[MicMonitor] Exited with code ${code}`);
      micMonitorProcess = null;
    });
  } catch (error) {
    console.error("[MicMonitor] Error starting:", error);
    micMonitorProcess = null;
  }
}

// Stop mic-monitor helper process
function stopMicMonitor(): void {
  if (micMonitorProcess) {
    console.log("[MicMonitor] Stopping...");
    micMonitorProcess.kill("SIGTERM");
    micMonitorProcess = null;
    micActive = false;
  }
}

// Get icon path for Windows and Linux (Mac uses .icns from package.json)
const getIconPath = () => {
  if (process.platform === "darwin") {
    return undefined; // Mac uses .icns from bundle
  }
  const ext = process.platform === "win32" ? ".ico" : ".png";
  return path.join(__dirname, `../resources/icons/icon${ext}`);
};

// HTML escape helper for XSS prevention
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Get tray icon path based on platform
const getTrayIconPath = (): string => {
  const iconsDir = app.isPackaged
    ? path.join(process.resourcesPath, "icons")
    : path.join(__dirname, "../resources/icons");

  if (process.platform === "darwin") {
    // テンプレートアイコンがあればそれを使う（ダーク/ライトモード自動対応）
    // ファイル名にTemplateを含めるとElectronが自動認識し、@2xも自動読み込み
    const templatePath = path.join(iconsDir, "trayTemplate.png");
    if (fs.existsSync(templatePath)) return templatePath;
    // フォールバック: 既存アイコンを使用
    return path.join(iconsDir, "icon.png");
  }
  // Windows: .ico、Linux: .png
  const ext = process.platform === "win32" ? "icon.ico" : "tray.png";
  return path.join(iconsDir, ext);
};

// Create system tray icon with context menu
const createTray = () => {
  const iconPath = getTrayIconPath();
  let icon = nativeImage.createFromPath(iconPath);

  // テンプレートアイコンが見つからなかった場合、既存アイコンをリサイズ
  if (!iconPath.includes("Template") && process.platform === "darwin") {
    icon = icon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  tray.setToolTip("CC Mascot");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "設定を開く",
      click: () => createSettingsWindow(),
    },
    { type: "separator" },
    {
      label: "バージョン情報",
      click: async () => {
        const { response } = await dialog.showMessageBox({
          type: "info",
          title: "CC Mascot",
          message: `CC Mascot v${app.getVersion()}`,
          detail: [
            `Electron: v${process.versions.electron}`,
            `Chrome: v${process.versions.chrome}`,
            `Node.js: v${process.versions.node}`,
          ].join("\n"),
          buttons: ["ライセンス情報", "OK"],
        });
        if (response === 0) {
          createLicenseWindow();
        }
      },
    },
    {
      label: "終了",
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
};

// Engine type and path constants
type EngineType = "aivis" | "voicevox" | "custom";

// Platform-specific engine paths
const MAC_ENGINE_PATHS: Record<Exclude<EngineType, "custom">, string> = {
  aivis: "/Applications/AivisSpeech.app/Contents/Resources/AivisSpeech-Engine/run",
  voicevox: "/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run",
};

const WINDOWS_ENGINE_PATHS: Record<Exclude<EngineType, "custom">, string> = {
  aivis: "C:\\Program Files\\AivisSpeech\\AivisSpeech-Engine\\run.exe",
  voicevox: "C:\\Program Files\\VOICEVOX\\vv-engine\\run.exe",
};

const LINUX_ENGINE_PATHS: Record<Exclude<EngineType, "custom">, string> = {
  aivis: "/opt/AivisSpeech/AivisSpeech-Engine/run",
  voicevox: "/opt/VOICEVOX/vv-engine/run",
};

// Get the actual engine path based on engine type and platform
function getEnginePath(): string | undefined {
  const engineType = (store.get("engineType") as EngineType | undefined) || "aivis"; // Default to AivisSpeech
  console.log(`[getEnginePath] Engine type: ${engineType}, platform: ${process.platform}`);
  if (engineType === "custom") {
    const customPath = store.get("voicevoxEnginePath") as string | undefined;
    console.log(`[getEnginePath] Custom path: ${customPath}`);
    return customPath;
  }

  // Select path based on platform
  let enginePaths: Record<Exclude<EngineType, "custom">, string>;
  if (process.platform === "win32") {
    enginePaths = WINDOWS_ENGINE_PATHS;
  } else if (process.platform === "darwin") {
    enginePaths = MAC_ENGINE_PATHS;
  } else {
    enginePaths = LINUX_ENGINE_PATHS;
  }

  const path = enginePaths[engineType];
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

// Kill process tree on Windows (taskkill /T terminates child processes)
function killProcessTree(pid: number): void {
  try {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
  } catch {
    // Process may have already exited
  }
}

// Stop VOICEVOX Engine
async function stopVoicevoxEngine(): Promise<void> {
  if (voicevoxProcess) {
    console.log("[Engine] Stopping engine...");
    const proc = voicevoxProcess;
    voicevoxProcess = null;

    if (process.platform === "win32" && proc.pid) {
      killProcessTree(proc.pid);
    } else {
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
    }

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

      // macOS: ウィンドウが表示された後にDockを非表示にする
      // ※起動時にapp.dock.hide()を呼ぶとフルスクリーンSpaceで起動してしまうため
      if (process.platform === "darwin" && app.dock) {
        setTimeout(() => {
          app.dock.hide();
          console.log("[Main] Dock icon hidden after window shown");
        }, 500);
      }
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
    startLogMonitor();
  });

  // Disable always-on-top when DevTools is opened to allow switching to other apps
  mainWindow.webContents.on("devtools-opened", () => {
    console.log("[Main] DevTools opened, disabling always-on-top and resizing to avoid menu bar");
    mainWindow?.setAlwaysOnTop(false);
    mainWindow?.webContents.send("devtools-state-changed", true);
    settingsWindow?.webContents.send("main-devtools-state-changed", true);

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
    settingsWindow?.webContents.send("main-devtools-state-changed", false);

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

  // Notify settings window of its own DevTools state changes
  settingsWindow.webContents.on("devtools-opened", () => {
    settingsWindow?.webContents.send("settings-devtools-state-changed", true);
  });

  settingsWindow.webContents.on("devtools-closed", () => {
    settingsWindow?.webContents.send("settings-devtools-state-changed", false);
  });

  // Open DevTools in development
  if (process.env.VITE_DEV_SERVER_URL) {
    // mainWindow?.webContents.openDevTools();
    // settingsWindow.webContents.openDevTools();
  }
};

// Create license window
const createLicenseWindow = () => {
  if (licenseWindow && !licenseWindow.isDestroyed()) {
    licenseWindow.focus();
    return;
  }

  // Read licenses.json
  const licensesPath = process.env.VITE_DEV_SERVER_URL
    ? path.join(__dirname, "../public/licenses.json")
    : path.join(__dirname, "../dist/licenses.json");

  let licensesData: Record<
    string,
    {
      licenses?: string;
      licenseText?: string;
      repository?: string;
      publisher?: string;
    }
  > = {};

  try {
    const fileContent = fs.readFileSync(licensesPath, "utf-8");
    licensesData = JSON.parse(fileContent);
  } catch (error) {
    console.error("[License] Failed to load licenses.json:", error);
    dialog.showErrorBox(
      "ライセンス情報の読み込みエラー",
      "ライセンス情報ファイルが見つかりませんでした。\nビルドを実行してください。",
    );
    return;
  }

  // Generate HTML content
  const licensesHtml = Object.entries(licensesData)
    .map(([name, info]) => {
      const licenseType = info.licenses || "Unknown";
      const licenseText = info.licenseText || "License text not available";
      const repository = info.repository || "";
      const publisher = info.publisher || "";

      return `
        <details>
          <summary>
            <strong>${escapeHtml(name)}</strong> - ${escapeHtml(licenseType)}
            ${publisher ? `<span class="publisher">(${escapeHtml(publisher)})</span>` : ""}
          </summary>
          <div class="license-content">
            ${repository ? `<p class="repository">Repository: <a href="${escapeHtml(repository)}" target="_blank">${escapeHtml(repository)}</a></p>` : ""}
            <pre>${escapeHtml(licenseText)}</pre>
          </div>
        </details>
      `;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OSSライセンス情報</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f5f5;
        }
        h1 {
          font-size: 24px;
          margin: 0 0 20px 0;
          color: #333;
        }
        details {
          background: white;
          border-radius: 4px;
          margin-bottom: 8px;
          padding: 12px;
          border: 1px solid #e0e0e0;
        }
        summary {
          cursor: pointer;
          font-size: 14px;
          outline: none;
          user-select: none;
          color: #333;
        }
        summary:hover {
          color: #0066cc;
        }
        .publisher {
          color: #666;
          font-size: 13px;
        }
        .license-content {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e0e0e0;
        }
        .repository {
          font-size: 13px;
          color: #666;
          margin: 0 0 12px 0;
        }
        .repository a {
          color: #0066cc;
          text-decoration: none;
        }
        .repository a:hover {
          text-decoration: underline;
        }
        pre {
          background-color: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          padding: 12px;
          font-size: 12px;
          line-height: 1.5;
          overflow-x: auto;
          white-space: pre-wrap;
          word-wrap: break-word;
          margin: 0;
        }
      </style>
    </head>
    <body>
      <h1>OSSライセンス情報</h1>
      ${licensesHtml}
    </body>
    </html>
  `;

  licenseWindow = new BrowserWindow({
    width: 700,
    height: 600,
    icon: getIconPath(),
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  licenseWindow.setAlwaysOnTop(true, "pop-up-menu", 1);

  // Load HTML from data URI
  licenseWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Open links in external browser
  licenseWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  licenseWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("data:")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  licenseWindow.on("closed", () => {
    licenseWindow = null;
  });
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

// Reset character position to default (center-bottom)
ipcMain.handle("reset-character-position", () => {
  store.delete("characterPosition");

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("character-position-reset");
  }

  return true;
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
  store.delete("muteOnMicActive");
  store.delete("includeSubAgents");
  stopMicMonitor();

  await stopVoicevoxEngine();
  await startVoicevoxEngine();

  // Restart log monitor with default settings
  startLogMonitor();

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

// Toggle DevTools for main or settings window
ipcMain.handle("toggle-devtools", (_event, target: "main" | "settings") => {
  if (target === "main") {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
      return mainWindow.webContents.isDevToolsOpened();
    }
  } else {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      if (settingsWindow.webContents.isDevToolsOpened()) {
        settingsWindow.webContents.closeDevTools();
      } else {
        settingsWindow.webContents.openDevTools();
      }
      return settingsWindow.webContents.isDevToolsOpened();
    }
  }
  return false;
});

// Get DevTools state for main or settings window
ipcMain.handle("get-devtools-state", (_event, target: "main" | "settings") => {
  if (target === "main") {
    return mainWindow?.webContents.isDevToolsOpened() ?? false;
  }
  return settingsWindow?.webContents.isDevToolsOpened() ?? false;
});

// Mic monitor settings
ipcMain.handle("get-mute-on-mic-active", () => {
  const value = store.get("muteOnMicActive");
  return value === undefined ? true : (value as boolean);
});

ipcMain.handle("set-mute-on-mic-active", (_event, value: boolean) => {
  store.set("muteOnMicActive", value);
  if (value) {
    startMicMonitor();
  } else {
    stopMicMonitor();
    // Notify renderer that mic is no longer active
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("mic-active-changed", false);
    }
  }
  // Notify settings window of the change
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("mute-on-mic-active-changed", value);
  }
  return true;
});

ipcMain.handle("get-default-engine-path", (_event, engineType: Exclude<EngineType, "custom">) => {
  let enginePaths: Record<Exclude<EngineType, "custom">, string>;
  if (process.platform === "win32") {
    enginePaths = WINDOWS_ENGINE_PATHS;
  } else if (process.platform === "darwin") {
    enginePaths = MAC_ENGINE_PATHS;
  } else {
    enginePaths = LINUX_ENGINE_PATHS;
  }
  return enginePaths[engineType];
});

ipcMain.handle("get-mic-monitor-available", () => {
  return getMicMonitorPath() !== undefined;
});

ipcMain.handle("get-include-sub-agents", () => {
  const value = store.get("includeSubAgents");
  return value === undefined ? false : (value as boolean);
});

ipcMain.handle("set-include-sub-agents", (_event, value: boolean) => {
  store.set("includeSubAgents", value);
  console.log(`[IPC] includeSubAgents set to ${value}, restarting log monitor`);
  startLogMonitor();
  return true;
});

ipcMain.on("set-ignore-mouse-events", (_event, ignore: boolean) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Always use forward: true to keep receiving mouse move events even when ignoring clicks
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  createTray();
  await startVoicevoxEngine();

  // Start mic monitor if enabled (default: true)
  if (store.get("muteOnMicActive") !== false) {
    startMicMonitor();
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 常駐アプリなので、ウィンドウが全て閉じてもアプリは終了しない
app.on("window-all-closed", () => {
  // noop: trayから終了する
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
  if (tray) {
    tray.destroy();
    tray = null;
  }
  stopMicMonitor();
  await stopVoicevoxEngine();

  app.quit();
});
