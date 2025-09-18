import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentLogStep } from '@mindforge/shared';
import { Button, Space, Tag, Typography, Switch } from 'antd';
import { useVirtualizer } from '@tanstack/react-virtual';

type Props = {
  steps?: AgentLogStep[];
  defaultCollapsed?: boolean; // 默认折叠（需求：默认折叠）
};

/**
 * AgentLogOutline：按步骤分组的可折叠日志视图。
 * - 头部展示 index/role/summary；
 * - 内容区显示该步骤的主要文本与工具调用摘要；
 * - 默认折叠；提供“全部展开/折叠”。
 */
export default function AgentLogOutline({ steps = [], defaultCollapsed = true }: Props) {
  // 默认展开异常步骤；其余根据 defaultCollapsed
  const initialOpen = useMemo(() => new Set(steps.filter(s => isErrorStep(s)).map(s => s.id)), [steps]);
  const [openSet, setOpenSet] = useState<Set<string>>(initialOpen);
  useEffect(() => {
    // 新增的异常步骤自动展开
    for (const s of steps) if (isErrorStep(s)) initialOpen.add(s.id);
    setOpenSet(new Set(initialOpen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const parentRef = useRef<HTMLDivElement>(null);
  const [tailing, setTailing] = useState(true);

  const virtualizer = useVirtualizer({
    count: steps.length,
    getItemKey: (index) => steps[index]?.id ?? `idx-${index}`,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (openSet.has(steps[index]?.id ?? '') ? 140 : 44),
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // 尾随滚动：仅在用户接近底部且 tailing=true 时触发
  useEffect(() => {
    const el = parentRef.current;
    if (!el || !tailing) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) {
      // 滚动到最后一项
      virtualizer.scrollToIndex(Math.max(steps.length - 1, 0), { align: 'end' });
    }
  }, [steps.length, tailing, virtualizer]);

  // 监听用户手动滚动以暂停尾随
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onScroll = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
      setTailing(nearBottom);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
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
        <Space size={8}>
          <Typography.Text type="secondary">尾随</Typography.Text>
          <Switch size="small" checked={tailing} onChange={(v) => setTailing(v)} />
        </Space>
      </div>
      <div ref={parentRef} style={{ maxHeight: 320, overflow: 'auto', position: 'relative', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <div style={{ height: totalSize, position: 'relative', width: '100%' }}>
          {items.map((vi) => {
            const s = steps[vi.index];
            if (!s) return null;
            const open = openSet.has(s.id);
            return (
              <div
                key={s.id}
                ref={(el) => el && virtualizer.measureElement(el)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vi.start}px)`,
                  padding: '8px 12px',
                  borderBottom: '1px solid #f0f0f0',
                  background: isErrorStep(s) ? '#fff7f7' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                     onClick={() => {
                       const next = new Set(openSet);
                       if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                       setOpenSet(next);
                       // 展开时尽快测量高度
                       requestAnimationFrame(() => virtualizer.measure());
                     }}
                >
                  <Typography.Text type="secondary">#{s.index}</Typography.Text>
                  <Tag color={isErrorStep(s) ? 'red' : roleColor(s.role)} style={{ textTransform: 'uppercase' }}>{s.role}</Tag>
                  <Typography.Text>{s.summary}</Typography.Text>
                </div>
                {open && (
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: 6 }}>
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
