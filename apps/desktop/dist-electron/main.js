"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_node_path = __toESM(require("node:path"), 1);
var mainWindow = null;
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
  mainWindow = new import_electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    webPreferences: {
      preload: import_node_path.default.join(__dirname, "preload.js"),
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
    const indexHtml = import_node_path.default.join(__dirname, "index.html");
    await mainWindow.loadFile(indexHtml);
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      import_electron.shell.openExternal(url);
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
import_electron.ipcMain.on("window:minimize", () => {
  try {
    mainWindow?.minimize();
  } catch {
  }
});
import_electron.ipcMain.on("window:toggle-maximize", () => {
  try {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  } catch {
  }
});
import_electron.ipcMain.handle("window:is-maximized", () => {
  try {
    return !!mainWindow?.isMaximized();
  } catch {
    return false;
  }
});
import_electron.ipcMain.on("window:close", () => {
  try {
    mainWindow?.close();
  } catch {
  }
});
import_electron.ipcMain.handle("get-platform", () => getPlatformTag());
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
import_electron.app.whenReady().then(async () => {
  await createWindow();
  import_electron.app.on("activate", async () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});
//# sourceMappingURL=main.js.map
