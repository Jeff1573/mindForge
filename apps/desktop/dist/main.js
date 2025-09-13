"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
// MCP：主进程最小客户端接口
const sessionManager_1 = require("./mcp/sessionManager");
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
    // MCP：会话管理器（最小实现，不连接 UI 配置）
    const mcp = new sessionManager_1.McpSessionManager();
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
    // ========== MCP 最小 IPC 接口 ==========
    // 说明：本期仅提供编程接口，不做 UI 配置对接
    electron_1.ipcMain.handle('mcp/create', (_e, spec) => {
        // 中文注释：仅创建，不自动连接/初始化
        const handle = mcp.create(spec);
        // 事件转发：最小实现将关键信号透传给当前主窗口
        handle.client.on('tools:listChanged', () => {
            try {
                mainWindow?.webContents.send('mcp:tools:listChanged', { id: handle.id });
            }
            catch { /* noop */ }
        });
        handle.client.on('notification', (n) => {
            try {
                mainWindow?.webContents.send('mcp:stream:data', { id: handle.id, notification: n });
            }
            catch { /* noop */ }
        });
        handle.client.on('log', (level, message, meta) => {
            try {
                mainWindow?.webContents.send('mcp:log', { id: handle.id, level, message, meta });
            }
            catch { /* noop */ }
        });
        handle.client.on('error', (err) => {
            try {
                mainWindow?.webContents.send('mcp:error', { id: handle.id, message: String(err) });
            }
            catch { /* noop */ }
        });
        handle.client.on('close', (code, reason) => {
            try {
                mainWindow?.webContents.send('mcp:close', { id: handle.id, code, reason });
            }
            catch { /* noop */ }
        });
        return { id: handle.id };
    });
    // 通过 mcp.json 批量创建会话（不自动连接）。
    // 路径优先级：调用参数 > 环境变量 MF_MCP_CONFIG > 当前目录 ./mcp.json
    electron_1.ipcMain.handle('mcp/createFromConfig', (_e, configPath) => {
        const handles = mcp.createFromConfig(configPath);
        for (const handle of handles) {
            // 事件转发与单个创建一致
            handle.client.on('tools:listChanged', () => {
                try {
                    mainWindow?.webContents.send('mcp:tools:listChanged', { id: handle.id });
                }
                catch { /* noop */ }
            });
            handle.client.on('notification', (n) => {
                try {
                    mainWindow?.webContents.send('mcp:stream:data', { id: handle.id, notification: n });
                }
                catch { /* noop */ }
            });
            handle.client.on('log', (level, message, meta) => {
                try {
                    mainWindow?.webContents.send('mcp:log', { id: handle.id, level, message, meta });
                }
                catch { /* noop */ }
            });
            handle.client.on('error', (err) => {
                try {
                    mainWindow?.webContents.send('mcp:error', { id: handle.id, message: String(err) });
                }
                catch { /* noop */ }
            });
            handle.client.on('close', (code, reason) => {
                try {
                    mainWindow?.webContents.send('mcp:close', { id: handle.id, code, reason });
                }
                catch { /* noop */ }
            });
        }
        return { ids: handles.map(h => h.id) };
    });
    electron_1.ipcMain.handle('mcp/start', async (_e, id) => {
        const s = mcp.get(id);
        if (!s)
            throw new Error(`Session not found: ${id}`);
        await s.start();
        return { ok: true };
    });
    electron_1.ipcMain.handle('mcp/initialize', async (_e, id) => {
        const s = mcp.get(id);
        if (!s)
            throw new Error(`Session not found: ${id}`);
        const result = await s.initialize();
        return result;
    });
    electron_1.ipcMain.handle('mcp/listTools', async (_e, id, cursor) => {
        const s = mcp.get(id);
        if (!s)
            throw new Error(`Session not found: ${id}`);
        return await s.client.listTools(cursor);
    });
    electron_1.ipcMain.handle('mcp/callTool', async (_e, id, name, args) => {
        const s = mcp.get(id);
        if (!s)
            throw new Error(`Session not found: ${id}`);
        return await s.client.callTool(name, args);
    });
    electron_1.ipcMain.handle('mcp/stop', async (_e, id) => {
        const s = mcp.get(id);
        if (!s)
            return { ok: true };
        await s.stop();
        return { ok: true };
    });
    await createWindow();
    electron_1.app.on('activate', async () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            await createWindow();
    });
});
//# sourceMappingURL=main.js.map