import React, { useMemo, useState } from 'react';
import type { AgentLogStep } from '@mindforge/shared';
import { Button, Collapse, Space, Tag, Typography } from 'antd';

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
  const items = useMemo(() => steps.map((s) => ({
    key: s.id,
    label: (
      <Space size={8} align="center">
        <Typography.Text type="secondary">#{s.index}</Typography.Text>
        <Tag color={roleColor(s.role)} style={{ textTransform: 'uppercase' }}>{s.role}</Tag>
        <Typography.Text>{s.summary}</Typography.Text>
      </Space>
    ),
    children: (
      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {s.content}
      </div>
    ),
  })), [steps]);

  const [activeKeys, setActiveKeys] = useState<string[] | undefined>(defaultCollapsed ? [] : items.map(i => String(i.key)));

  const expandAll = () => setActiveKeys(items.map(i => String(i.key)));
  const collapseAll = () => setActiveKeys([]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Space size={8}>
          <Button size="small" onClick={expandAll}>全部展开</Button>
          <Button size="small" onClick={collapseAll}>全部折叠</Button>
        </Space>
      </div>
      <Collapse
        items={items as any}
        activeKey={activeKeys as any}
        onChange={(keys) => setActiveKeys(Array.isArray(keys) ? (keys as string[]) : [String(keys)])}
        bordered
      />
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

