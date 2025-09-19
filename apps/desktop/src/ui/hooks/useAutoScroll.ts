/**
 * 文档：日志尾随自动滚动 Hook（悬停暂停）。
 * 
 * 目标：当依赖项（通常为列表长度）变化时，若用户未将鼠标悬停在滚动容器上，
 * 则将容器瞬时滚动到底部；当用户鼠标进入容器时暂停尾随，移出后恢复。
 * 
 * 依据（Evidence）：
 * - React useLayoutEffect（在浏览器绘制前进行同步布局读写）
 *   参见：https://react.dev/reference/react/useLayoutEffect
 * - React DOM Mouse Events：onMouseEnter/onMouseLeave 对应的原生事件
 *   参见：https://react.dev/reference/react-dom/components/common#mouse-events
 * - MDN Element.scrollTop / Element.scrollHeight（进行滚动到底部）
 *   参见：https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTop
 *         https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export interface AutoScrollOptions {
  /** 是否启用；默认启用 */
  enabled?: boolean;
}

/**
 * useAutoScroll
 * 
 * @param containerRef 滚动容器的 ref（例如指向一个设置了 `overflow: auto` 的 div）
 * @param deps 依赖数组，通常传入 `[items.length]` 表示有新日志追加
 * @param options 行为开关；目前仅支持 `enabled`
 * @returns { hovering: boolean } 当前是否处于悬停状态（仅做状态展示/调试用）
 */
export function useAutoScroll<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  deps: readonly unknown[],
  options?: AutoScrollOptions
) {
  const { enabled = true } = options ?? {};

  // 悬停状态（state 仅用于触发渲染/调试；判定依赖 ref 更可靠）
  const [hovering, setHovering] = useState(false);
  const hoveringRef = useRef(false);

  // 绑定/解绑鼠标进入离开事件（在容器元素上监听）
  useEffect(() => {
    // SSR/非浏览器环境保护
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const el = containerRef.current;
    if (!el) return;

    const onEnter = () => {
      hoveringRef.current = true;
      setHovering(true);
    };
    const onLeave = () => {
      hoveringRef.current = false;
      setHovering(false);
    };

    // 使用鼠标事件，无需 capture；passive 对 mouse 事件无意义但不伤害
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [containerRef]);

  // 当依赖变化且未悬停时，瞬时滚动到底（不使用 smooth）
  useLayoutEffect(() => {
    if (!enabled) return;
    // 仅浏览器环境执行
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const el = containerRef.current;
    if (!el) return;
    if (hoveringRef.current) return; // 用户正在查看历史，暂停尾随

    // 若元素隐藏（display: none）scrollHeight 为 0，不影响安全性
    try {
      // 将滚动位置直接设置为底部，瞬时无动画
      el.scrollTop = el.scrollHeight;
    } catch {
      // 忽略异常（例如某些旧内核或不可滚动容器）
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, containerRef, ...deps]);

  return { hovering } as const;
}

export default useAutoScroll;
