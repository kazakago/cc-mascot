import { app, dialog } from "electron";
import pkg from "electron-updater";
const { autoUpdater } = pkg;

// Configure auto updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

let isCheckingManually = false;

function setupEventHandlers(): void {
  autoUpdater.on("update-available", async (info) => {
    console.log(`[AutoUpdater] Update available: v${info.version}`);

    const { response } = await dialog.showMessageBox({
      type: "info",
      title: "アップデート",
      message: `新しいバージョン v${info.version} が利用可能です`,
      detail: "ダウンロードしますか？",
      buttons: ["ダウンロード", "後で"],
    });

    if (response === 0) {
      console.log("[AutoUpdater] User accepted download");
      autoUpdater.downloadUpdate();
    } else {
      console.log("[AutoUpdater] User deferred update");
    }
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[AutoUpdater] No updates available");

    if (isCheckingManually) {
      isCheckingManually = false;
      dialog.showMessageBox({
        type: "info",
        title: "アップデート",
        message: "最新バージョンです",
        detail: `現在のバージョン: v${app.getVersion()}`,
        buttons: ["OK"],
      });
    }
  });

  autoUpdater.on("update-downloaded", async () => {
    console.log("[AutoUpdater] Update downloaded");

    const { response } = await dialog.showMessageBox({
      type: "info",
      title: "アップデート",
      message: "アップデートのダウンロードが完了しました",
      detail: "再起動してインストールしますか？",
      buttons: ["再起動してインストール", "後で"],
    });

    if (response === 0) {
      console.log("[AutoUpdater] User accepted install, quitting and installing");
      autoUpdater.quitAndInstall();
    } else {
      console.log("[AutoUpdater] User deferred install");
    }
  });

  autoUpdater.on("error", (error) => {
    console.error("[AutoUpdater] Error:", error.message);

    if (isCheckingManually) {
      isCheckingManually = false;
      dialog.showMessageBox({
        type: "error",
        title: "アップデート",
        message: "アップデートの確認に失敗しました",
        detail: error.message,
        buttons: ["OK"],
      });
    }
  });
}

export function initAutoUpdater(): void {
  if (!app.isPackaged) {
    console.log("[AutoUpdater] Skipping update check in development mode");
    return;
  }

  setupEventHandlers();

  // Check every 24 hours (1 day)
  const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  // Initial check with delay to allow UI to initialize
  setTimeout(() => {
    console.log("[AutoUpdater] Checking for updates...");
    autoUpdater.checkForUpdates();
  }, 5_000);

  // Periodic check every 24 hours
  setInterval(() => {
    console.log("[AutoUpdater] Scheduled daily update check...");
    autoUpdater.checkForUpdates();
  }, CHECK_INTERVAL);
}

export function checkForUpdatesManually(): void {
  if (!app.isPackaged) {
    console.log("[AutoUpdater] Skipping update check in development mode");
    dialog.showMessageBox({
      type: "info",
      title: "アップデート",
      message: "開発モードではアップデートを確認できません",
      buttons: ["OK"],
    });
    return;
  }

  console.log("[AutoUpdater] Manual update check requested");
  isCheckingManually = true;
  autoUpdater.checkForUpdates();
}
