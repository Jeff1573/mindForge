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
  const prevLenRef = useRef<number>(steps.length);
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
    if (!el || !tailing) { prevLenRef.current = steps.length; return; }
    // 仅当“新增步骤”时才自动尾随，避免展开/折叠引起跳动
    const appended = steps.length > prevLenRef.current;
    prevLenRef.current = steps.length;
    if (!appended) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) {
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
      <div
        ref={parentRef}
        style={{
          maxHeight: 320,
          overflow: 'auto',
          position: 'relative',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          // 防止浏览器滚动锚点导致的跳动
          overflowAnchor: 'none' as any,
          // 隔离绘制，减少重排影响
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
                ref={(el) => el && virtualizer.measureElement(el)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vi.start}px)`,
                  // 注意：不设置固定 height，交由实际内容高度 + measureElement 决定
                  padding: '8px 12px',
                  borderBottom: '1px solid #f0f0f0',
                  background: isErrorStep(s) ? '#fff7f7' : '#fff',
                  zIndex: open ? 1000 : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                     onClick={() => {
                       const next = new Set(openSet);
                       if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                       setOpenSet(next);
                       // 用户交互时暂停尾随，避免跳动
                       setTailing(false);
                       // 展开时尽快测量高度并保留当前滚动位置
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
                      // 展开内容区域固定高度并滚动
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
