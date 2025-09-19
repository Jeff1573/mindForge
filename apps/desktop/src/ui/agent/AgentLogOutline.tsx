import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentLogStep } from '@mindforge/shared';
import { Button, Space, Tag, Typography } from 'antd';
import { useVirtualizer } from '@tanstack/react-virtual';

type Props = {
  steps?: AgentLogStep[];
  defaultCollapsed?: boolean; // 默认折叠与否（预留，当前不影响逻辑）
};

/**
 * AgentLogOutline
 * 文档说明：
 * - 展示步骤大纲（虚拟化渲染）。
 * - 自动滚动规则：当 steps 追加时，若鼠标未悬停在滚动容器上，则瞬时滚动至底部；
 *   当鼠标悬停于容器内时，暂停自动滚动；鼠标移出后恢复自动滚动。
 * - 滚动实现：react-virtual 的 virtualizer.scrollToIndex，避免与虚拟化冲突。
 * - 事件依据：mouseenter/mouseleave（React DOM 与原生一致）。
 */
export default function AgentLogOutline({ steps = [], defaultCollapsed = true }: Props) {
  // 初始展开所有错误步骤
  const initialOpen = useMemo(() => new Set(steps.filter(s => isErrorStep(s)).map(s => s.id)), [steps]);
  const [openSet, setOpenSet] = useState<Set<string>>(initialOpen);
  useEffect(() => {
    for (const s of steps) if (isErrorStep(s)) initialOpen.add(s.id);
    setOpenSet(new Set(initialOpen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  // 滚动容器与状态
  const parentRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef<number>(steps.length);
  // 自动尾随（由悬停控制）：mouseenter -> false；mouseleave -> true
  const [tailing, setTailing] = useState(true);

  const virtualizer = useVirtualizer({
    count: steps.length,
    getItemKey: (index) => steps[index]?.id ?? `idx-${index}`,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (openSet.has(steps[index]?.id ?? '') ? 140 : 44),
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // 新增项且允许尾随 → 滚动到最后一项（瞬时）
  useEffect(() => {
    const el = parentRef.current;
    if (!el) { prevLenRef.current = steps.length; return; }
    const appended = steps.length > prevLenRef.current;
    prevLenRef.current = steps.length;
    if (!appended) return;
    if (!tailing) return; // 悬停暂停
    virtualizer.scrollToIndex(Math.max(steps.length - 1, 0), { align: 'end' });
  }, [steps.length, tailing, virtualizer]);

  // 悬停进入/离开：暂停/恢复尾随
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onEnter = () => setTailing(false);
    const onLeave = () => setTailing(true);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  const expandAll = () => setOpenSet(new Set(steps.map(s => s.id)));
  const collapseAll = () => setOpenSet(new Set(steps.filter(s => isErrorStep(s)).map(s => s.id)));

  const totalSize = virtualizer.getTotalSize();
  const items = virtualizer.getVirtualItems();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Space size={8}>
          <Button size="small" onClick={expandAll}>全部展开</Button>
          <Button size="small" onClick={collapseAll}>全部折叠</Button>
        </Space>
        {/* 尾随开关移除：采用“悬停暂停，移出恢复”的交互 */}
      </div>
      <div
        ref={parentRef}
        style={{
          maxHeight: 320,
          overflow: 'auto',
          position: 'relative',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          // 防止浏览器自动锚点干扰（非标准属性）
          overflowAnchor: 'none' as any,
          // 性能优化：隔离布局/绘制
          contain: 'layout paint',
        }}
      >
        <div style={{ height: totalSize, position: 'relative', width: '100%' }}>
          {items.map((vi) => {
            const s = steps[vi.index];
            if (!s) return null;
            const open = openSet.has(s.id);
            return (
              <div
                key={s.id}
                ref={(el) => { if (el) virtualizer.measureElement(el); }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vi.start}px)`,
                  padding: '8px 12px',
                  borderBottom: '1px solid #f0f0f0',
                  background: isErrorStep(s) ? '#fff7f7' : '#fff',
                  zIndex: open ? 1000 : 0,
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  onClick={() => {
                    const next = new Set(openSet);
                    if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                    setOpenSet(next);
                    // 展开/折叠后测量高度并保持当前滚动位置，避免跳动
                    const el = parentRef.current;
                    const top = el?.scrollTop ?? 0;
                    requestAnimationFrame(() => {
                      virtualizer.measure();
                      if (el) el.scrollTop = top;
                    });
                  }}
                >
                  <Typography.Text type="secondary">#{s.index}</Typography.Text>
                  <Tag color={isErrorStep(s) ? 'red' : roleColor(s.role)} style={{ textTransform: 'uppercase' }}>{s.role}</Tag>
                  <Typography.Text>{s.summary}</Typography.Text>
                </div>
                {open && (
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      marginTop: 6,
                      maxHeight: 200,
                      overflow: 'auto',
                      paddingRight: 4,
                      position: 'relative',
                      zIndex: 3,
                    }}
                  >
                    {s.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function roleColor(role: string): string {
  switch (role) {
    case 'user': return 'blue';
    case 'assistant': return 'green';
    case 'tool': return 'gold';
    case 'tool_result': return 'purple';
    case 'system': return 'default';
    default: return 'default';
  }
}

function isErrorStep(s: AgentLogStep): boolean {
  if (!s) return false;
  if (s.level === 'error') return true;
  if (typeof s.error === 'string' && s.error.length > 0) return true;
  return false;
}
