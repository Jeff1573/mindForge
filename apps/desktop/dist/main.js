"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
// 中文注释：创建应用主窗口（自定义标题栏，渲染器使用 Vite）
let mainWindow = null;
function getPlatformTag() {
    switch (process.platform) {
        case 'win32':
            return 'windows';
        case 'darwin':
            return 'mac';
        default:
            return 'linux';
    }
}
async function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 960,
        minHeight: 600,
        frame: false,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
        webPreferences: {
            // 中文注释：tsc 编译后预加载脚本输出为 dist/preload.js
            preload: node_path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            spellcheck: false,
        },
    });
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
        await mainWindow.loadURL(devServerUrl);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        const indexHtml = node_path_1.default.join(__dirname, 'index.html');
        await mainWindow.loadFile(indexHtml);
    }
    // 安全：用系统浏览器打开外部链接
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
            electron_1.shell.openExternal(url);
        }
        catch { /* noop */ }
        return { action: 'deny' };
    });
    // 将窗口尺寸变化事件转发给渲染器（用于更新最大化图标）
    mainWindow.on('resize', () => {
        try {
            mainWindow?.webContents.send('window:resized');
        }
        catch { /* noop */ }
    });
}
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.whenReady().then(async () => {
    // IPC：窗口控制与平台查询（确保 app 就绪后再注册）
    electron_1.ipcMain.on('window:minimize', () => { try {
        mainWindow?.minimize();
    }
    catch { /* noop */ } });
    electron_1.ipcMain.on('window:toggle-maximize', () => {
        try {
            if (!mainWindow)
                return;
            if (mainWindow.isMaximized())
                mainWindow.unmaximize();
            else
                mainWindow.maximize();
        }
        catch { /* noop */ }
    });
    electron_1.ipcMain.handle('window:is-maximized', () => {
        try {
            return !!mainWindow?.isMaximized();
        }
        catch {
            return false;
        }
    });
    electron_1.ipcMain.on('window:close', () => { try {
        mainWindow?.close();
    }
    catch { /* noop */ } });
    electron_1.ipcMain.handle('get-platform', () => getPlatformTag());
    await createWindow();
    electron_1.app.on('activate', async () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            await createWindow();
    });
});
//# sourceMappingURL=main.js.map