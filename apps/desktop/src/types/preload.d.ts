// 全局类型声明：为渲染器提供 window.api 的类型提示
// 注意：仅类型导入，不会参与打包
type PreloadApi = import('../../electron/preload').PreloadApi;

declare global {
  interface Window {
    api: PreloadApi;
  }
}

export {};

