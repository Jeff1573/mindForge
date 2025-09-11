/**
 * 平台检测与标识注入（桌面三端 + 移动端）
 * - 优先使用 Tauri API: `@tauri-apps/plugin-os`
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

/** 通过 Tauri API（若可用）检测平台 */
async function detectByTauri(): Promise<PlatformTag | null> {
  try {
    // Tauri v2: 使用官方插件 @tauri-apps/plugin-os
    const mod = await import('@tauri-apps/plugin-os');
    const p = (await (mod.platform?.())) as unknown as string | undefined; // 返回 linux|windows|darwin|android|ios 等
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

  // 1) 优先 Tauri
  const byTauri = await detectByTauri();
  if (byTauri) {
    tag = byTauri;
  } else {
    // 2) UA 回退
    tag = detectByUA();
  }

  if (html) {
    html.dataset.platform = tag;
  }
  return tag;
}

/** 便捷同步版本（尽早设置 UA 回退，随后用 Tauri 覆写） */
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


