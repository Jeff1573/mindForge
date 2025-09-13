/**
 * 平台检测与标识注入（桌面三端 + 移动端）
 * * - 优先使用 Electron API: `window.api.getPlatform`
 * - 回退到 UserAgent 检测（用于浏览器预览或缺少模块时）
 * - 结果写入 <html data-platform="windows|mac|linux|mobile|web">。
 */

export type PlatformTag = 'windows' | 'mac' | 'linux' | 'mobile' | 'web';

/** 粗略 UA 检测（仅作为回退） */
function detectByUA(): PlatformTag {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|ipod|mobile/.test(ua)) return 'mobile';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'mac';
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('linux')) return 'linux';
  return 'web';
}

/** 通过 Electron 预加载（若可用）或 UA 检测平台 */
async function detectByBridge(): Promise<PlatformTag | null> {
  try {
    // 预加载可选择暴露 `window.api.getPlatform()`，否则回退到 UA
    const p = (await (window as any)?.api?.getPlatform?.()) as string | undefined;
    if (!p) return null;
    switch (p) {
      case 'windows':
        return 'windows';
      case 'darwin':
        return 'mac';
      case 'linux':
        return 'linux';
      case 'android':
      case 'ios':
        return 'mobile';
      default:
        return 'web';
    }
  } catch {
    return null;
  }
}

/** 检测平台并写入到 <html data-platform>，返回最终标识 */
export async function applyPlatformDataset(): Promise<PlatformTag> {
  const html = typeof document !== 'undefined' ? document.documentElement : null;
  let tag: PlatformTag = 'web';

  // 1) 优先 Electron 预加载桥
  const byBridge = await detectByBridge();
  if (byBridge) {
    tag = byBridge;
  } else {
    // 2) UA 回退
    tag = detectByUA();
  }

  if (html) {
    html.dataset.platform = tag;
  }
  return tag;
}

/** 便捷同步版本（尽早设置 UA 回退，随后用 Electron 覆写） */
export function primePlatformDatasetSync() {
  try {
    const html = document.documentElement;
    if (!html.dataset.platform) {
      html.dataset.platform = detectByUA();
    }
  } catch {
    /* noop */
  }
}


