"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var api = {
  minimize: () => import_electron.ipcRenderer.send("window:minimize"),
  toggleMaximize: () => import_electron.ipcRenderer.send("window:toggle-maximize"),
  isMaximized: async () => import_electron.ipcRenderer.invoke("window:is-maximized"),
  close: () => import_electron.ipcRenderer.send("window:close"),
  onResized: (cb) => {
    const handler = () => cb();
    import_electron.ipcRenderer.on("window:resized", handler);
    return () => import_electron.ipcRenderer.removeListener("window:resized", handler);
  },
  getPlatform: async () => import_electron.ipcRenderer.invoke("get-platform")
};
import_electron.contextBridge.exposeInMainWorld("api", api);
//# sourceMappingURL=preload.js.map
