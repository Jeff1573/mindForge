"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// 中文注释：通过安全白名单 API 暴露必要能力给渲染器
const api = {
    minimize: () => electron_1.ipcRenderer.send('window:minimize'),
    toggleMaximize: () => electron_1.ipcRenderer.send('window:toggle-maximize'),
    isMaximized: async () => electron_1.ipcRenderer.invoke('window:is-maximized'),
    close: () => electron_1.ipcRenderer.send('window:close'),
    onResized: (cb) => {
        const handler = () => cb();
        electron_1.ipcRenderer.on('window:resized', handler);
        return () => electron_1.ipcRenderer.removeListener('window:resized', handler);
    },
    getPlatform: async () => electron_1.ipcRenderer.invoke('get-platform'),
};
electron_1.contextBridge.exposeInMainWorld('api', api);
//# sourceMappingURL=preload.js.map