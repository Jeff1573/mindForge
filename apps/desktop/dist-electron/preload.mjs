// electron/preload.ts
import { contextBridge, ipcRenderer } from "electron";
var api = {
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  isMaximized: async () => ipcRenderer.invoke("window:is-maximized"),
  close: () => ipcRenderer.send("window:close"),
  onResized: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("window:resized", handler);
    return () => ipcRenderer.removeListener("window:resized", handler);
  },
  getPlatform: async () => ipcRenderer.invoke("get-platform")
};
contextBridge.exposeInMainWorld("api", api);
//# sourceMappingURL=preload.mjs.map
