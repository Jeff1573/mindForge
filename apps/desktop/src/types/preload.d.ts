// 全局类型：将 Electron 预加载暴露的 API 合并到 window 上
// 仅类型导入，不会引入运行时代码
type _PreloadApi = import('../../electron/preload').PreloadApi;

declare global {
  interface Window {
    api: _PreloadApi;
  }
}

export {};

