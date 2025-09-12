import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';

// 中文注释：创建应用主窗口（自定义标题栏，渲染器使用 Vite）
let mainWindow: BrowserWindow | null = null;

function getPlatformTag(): 'windows' | 'mac' | 'linux' {
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
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
  } else {
    const indexHtml = path.join(__dirname, '../dist/index.html');
    await mainWindow.loadFile(indexHtml);
  }

  // 安全：用系统浏览器打开外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try { shell.openExternal(url); } catch { /* noop */ }
    return { action: 'deny' };
  });

  // 将窗口尺寸变化事件转发给渲染器（用于更新最大化图标）
  mainWindow.on('resize', () => {
    try { mainWindow?.webContents.send('window:resized'); } catch { /* noop */ }
  });
}

// IPC：窗口控制与平台查询
ipcMain.on('window:minimize', () => { try { mainWindow?.minimize(); } catch { /* noop */ } });
ipcMain.on('window:toggle-maximize', () => {
  try {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  } catch { /* noop */ }
});
ipcMain.handle('window:is-maximized', () => {
  try { return !!mainWindow?.isMaximized(); } catch { return false; }
});
ipcMain.on('window:close', () => { try { mainWindow?.close(); } catch { /* noop */ } });
ipcMain.handle('get-platform', () => getPlatformTag());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.whenReady().then(async () => {
  await createWindow();
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});


