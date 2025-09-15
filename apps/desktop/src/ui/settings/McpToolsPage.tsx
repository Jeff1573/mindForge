import React from 'react';
import { Badge, List, Avatar, Switch, Tooltip, Typography, Tag, Space, Skeleton, Alert } from 'antd';
import { ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';

type ToolInfo = { name: string; description?: string };

type RowStatus = 'idle' | 'connecting' | 'ready' | 'error' | 'stopped';

interface ServerRow {
  id: string;
  enabled: boolean;
  status: RowStatus;
  tools: ToolInfo[];
  loading: boolean; // UI 层加载骨架
  error?: string;
}

/**
 * McpToolsPage：显示 mcp.json 中的 MCP Server 列表与开关，并展示工具清单
 * - 开关 ON：start → initialize → listTools（分页聚合）
 * - 开关 OFF：stop（保留列表但置为 stopped）
 * - 事件：tools:listChanged/error/close → 刷新或更新状态
 */
export const McpToolsPage: React.FC = () => {
  const [rows, setRows] = React.useState<Record<string, ServerRow>>({});
  const [bridgeMissing, setBridgeMissing] = React.useState(false);

  // 工具：聚合所有分页的工具列表
  const listAllTools = React.useCallback(async (id: string): Promise<ToolInfo[]> => {
    const all: ToolInfo[] = [];
    let cursor: string | undefined = undefined;
    // 最多循环 50 页防止异常页游
    for (let i = 0; i < 50; i++) {
      const res = await window.api.mcp.listTools(id, cursor);
      if (Array.isArray(res?.tools)) all.push(...res.tools);
      if (res?.nextCursor) {
        cursor = res.nextCursor;
      } else {
        break;
      }
    }
    return all;
  }, []);

  // 处理：打开开关
  const enableServer = React.useCallback(async (id: string) => {
    setRows((s) => ({
      ...s,
      [id]: { ...(s[id] ?? { id, tools: [] }), id, enabled: true, status: 'connecting', loading: true, error: undefined },
    }));
    try {
      await window.api.mcp.start(id);
      await window.api.mcp.initialize(id);
      const tools = await listAllTools(id);
      setRows((s) => ({
        ...s,
        [id]: { ...(s[id] ?? { id, tools: [] }), id, enabled: true, status: 'ready', tools, loading: false, error: undefined },
      }));
    } catch (e) {
      setRows((s) => ({
        ...s,
        [id]: { ...(s[id] ?? { id, tools: [] }), id, enabled: false, status: 'error', loading: false, error: String(e) },
      }));
    }
  }, [listAllTools]);

  // 处理：关闭开关
  const disableServer = React.useCallback(async (id: string) => {
    setRows((s) => ({ ...s, [id]: { ...(s[id] ?? { id, tools: [] }), enabled: false, status: 'stopped', loading: false } }));
    try { await window.api.mcp.stop(id); } catch { /* noop */ }
  }, []);

  // 首次加载：从配置创建会话（不连接）并填充行
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!window?.api?.mcp) { setBridgeMissing(true); return; }
        const { ids } = await window.api.mcp.createFromConfig();
        if (!mounted) return;
        const initRows: Record<string, ServerRow> = {};
        for (const id of ids) {
          initRows[id] = { id, enabled: false, status: 'idle', tools: [], loading: false };
        }
        setRows(initRows);
      } catch (e) {
        // mcp.json 缺失也提示
        setBridgeMissing(true);
        // 控制台输出详细错误，避免 UI 噪音
        console.error('[McpToolsPage] init error', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // 事件订阅：工具列表更新、错误、关闭
  React.useEffect(() => {
    if (!window?.api?.mcp) return;
    const offList = window.api.mcp.onToolsListChanged(async ({ id }) => {
      const r = rows[id];
      if (!r?.enabled) return;
      try {
        const tools = await listAllTools(id);
        setRows((s) => ({ ...s, [id]: { ...(s[id] ?? { id, tools: [] }), tools } }));
      } catch { /* noop */ }
    });
    const offErr = window.api.mcp.onError(({ id, message }) => {
      setRows((s) => ({
        ...s,
        [id]: { ...(s[id] ?? { id, tools: [] }), status: 'error', enabled: false, loading: false, error: message },
      }));
    });
    const offClose = window.api.mcp.onClose(({ id }) => {
      setRows((s) => ({ ...s, [id]: { ...(s[id] ?? { id, tools: [] }), status: 'stopped', enabled: false } }));
    });
    return () => { offList?.(); offErr?.(); offClose?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, listAllTools]);

  const statusDot = (s: RowStatus) => {
    switch (s) {
      case 'connecting':
        return <Badge status="warning" />; // 黄色
      case 'ready':
        return <Badge status="success" />; // 绿色
      case 'error':
        return <Badge status="error" />;   // 红色
      case 'stopped':
        return <Badge status="default" />; // 灰色
      default:
        return <Badge status="processing" />; // 蓝色/进行中（idle）
    }
  };

  const Header = (
    <div style={{ padding: '4px 8px', color: 'hsl(var(--color-muted-foreground))' }}>
      MCP Tools
    </div>
  );

  const servers = Object.values(rows);

  return (
    <div style={{ padding: 16 }}>
      {Header}
      {bridgeMissing && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="无法连接到主进程 MCP 接口"
          description="请确认在 Electron 环境运行，且 mcp.json 存在并格式正确。"
        />
      )}
      <List
        itemLayout="horizontal"
        dataSource={servers}
        renderItem={(item) => {
          const initial = (item.id?.[0] ?? '?').toUpperCase();
          const description = (
            <div style={{ paddingTop: 4 }}>
              {item.loading ? (
                <Skeleton active paragraph={{ rows: 1 }} title={false} style={{ margin: 0 }} />
              ) : item.status === 'ready' && item.tools.length > 0 ? (
                <Space size={[6, 6]} wrap>
                  {item.tools.map((t) => (
                    <Tooltip key={t.name} title={t.description ?? '无描述'} placement="top">
                      <Tag>{t.name}</Tag>
                    </Tooltip>
                  ))}
                </Space>
              ) : (
                <Space size="small">
                  <span style={{ opacity: 0.8 }}>
                    {item.status === 'connecting' ? 'Loading tools' : 'No tools'}
                  </span>
                  {item.status === 'ready' && (
                    <Tooltip title="刷新工具列表">
                      <ReloadOutlined onClick={() => enableServer(item.id)} style={{ cursor: 'pointer' }} />
                    </Tooltip>
                  )}
                </Space>
              )}
              {item.error && (
                <div style={{ color: 'hsl(var(--color-destructive))', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <InfoCircleOutlined />
                  <Typography.Text type="danger" style={{ margin: 0 }}>
                    {item.error}
                  </Typography.Text>
                </div>
              )}
            </div>
          );

          return (
            <List.Item
              actions={[
                <Switch
                  key="switch"
                  checked={item.enabled}
                  onChange={(checked) => (checked ? enableServer(item.id) : disableServer(item.id))}
                />,
              ]}
              style={{
                background: 'hsl(var(--color-bg) / 0.98)',
                border: '1px solid hsl(var(--color-border) / 0.6)',
                marginBottom: 8,
                borderRadius: 'var(--radius-lg)',
                paddingRight: 12,
              }}
            >
              <List.Item.Meta
                avatar={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {statusDot(item.status)}
                    <Avatar style={{ backgroundColor: 'hsl(var(--color-muted))' }}>{initial}</Avatar>
                  </div>
                }
                title={<Typography.Text style={{ color: 'hsl(var(--color-fg))' }}>{item.id}</Typography.Text>}
                description={description}
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
};

export default McpToolsPage;
