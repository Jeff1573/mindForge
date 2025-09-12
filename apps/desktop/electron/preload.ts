import { contextBridge, ipcRenderer } from 'electron';

// 中文注释：通过安全白名单 API 暴露必要能力给渲染器
const api = {
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  isMaximized: async () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
  close: () => ipcRenderer.send('window:close'),
  onResized: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('window:resized', handler);
    return () => ipcRenderer.removeListener('window:resized', handler);
  },
  getPlatform: async () => ipcRenderer.invoke('get-platform') as Promise<'windows' | 'mac' | 'linux'>,
};

contextBridge.exposeInMainWorld('api', api);

export type PreloadApi = typeof api;


