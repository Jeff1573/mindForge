// electron/main.ts
import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
var mainWindow = null;
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
function getPlatformTag() {
  switch (process.platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "mac";
    default:
      return "linux";
  }
}
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      spellcheck: false
    }
  });
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexHtml = path.join(__dirname, "index.html");
    await mainWindow.loadFile(indexHtml);
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      shell.openExternal(url);
    } catch {
    }
    return { action: "deny" };
  });
  mainWindow.on("resize", () => {
    try {
      mainWindow?.webContents.send("window:resized");
    } catch {
    }
  });
}
ipcMain.on("window:minimize", () => {
  try {
    mainWindow?.minimize();
  } catch {
  }
});
ipcMain.on("window:toggle-maximize", () => {
  try {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  } catch {
  }
});
ipcMain.handle("window:is-maximized", () => {
  try {
    return !!mainWindow?.isMaximized();
  } catch {
    return false;
  }
});
ipcMain.on("window:close", () => {
  try {
    mainWindow?.close();
  } catch {
  }
});
ipcMain.handle("get-platform", () => getPlatformTag());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.whenReady().then(async () => {
  await createWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});
//# sourceMappingURL=main.mjs.map
