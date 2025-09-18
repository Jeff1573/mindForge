import React from 'react';
import { Badge, Tooltip, Typography } from 'antd';

type McpLightStatus = 'connecting' | 'ready' | 'stopped' | 'unavailable';

/**
 * McpStatusIndicator：在标题栏右侧展示 MCP 自启动是否成功
 * 约定：
 * - 使用主进程自启动机制（main.ts 已实现）。
 * - 判定规则：收到 tools:listChanged 事件或成功 listTools 视为 ready；
 *   10s 内未就绪或收到 close/error 则视为 stopped；若桥缺失则 unavailable。
 */
export default function McpStatusIndicator() {
  const [status, setStatus] = React.useState<McpLightStatus>('connecting');

  React.useEffect(() => {
    let mounted = true;
    const offs: (undefined | (() => void))[] = [];
    (async () => {
      if (!window?.api?.mcp) {
        setStatus('unavailable');
        return;
      }
      try {
        const { ids } = await window.api.mcp.createFromConfig();
        if (!ids?.length) { setStatus('stopped'); return; }

        // 事件：任一 tools 列表变更即视为 ready
        offs.push(window.api.mcp.onToolsListChanged?.(({ id }) => {
          if (!mounted) return;
          // 只要有一个可用即显示已连接
          setStatus('ready');
        }));
        // 事件：错误/关闭 → 若当前非 ready，则置 stopped（静默）
        offs.push(window.api.mcp.onError?.(({ id }) => {
          if (!mounted) return;
          setStatus((s) => (s === 'ready' ? s : 'stopped'));
        }));
        offs.push(window.api.mcp.onClose?.(({ id }) => {
          if (!mounted) return;
          setStatus((s) => (s === 'ready' ? s : 'stopped'));
        }));

        // 轮询兜底：10s 内每秒尝试 listTools，任何一次成功即 ready
        const deadline = Date.now() + 10_000;
        while (mounted && Date.now() < deadline) {
          try {
            // 并发尝试所有 id，任一成功即视为 ready
            const r = await Promise.any(ids.map((id) => window.api.mcp.listTools(id).then(() => true)));
            if (r) { setStatus('ready'); return; }
          } catch {
            // 所有 promise 失败，继续等待
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
        // 超时仍未就绪则标记为 stopped（静默）
        setStatus((s) => (s === 'ready' ? s : 'stopped'));
      } catch {
        setStatus('stopped');
      }
    })();
    return () => {
      mounted = false;
      for (const off of offs) { try { off?.(); } catch { /* noop */ } }
    };
  }, []);

  const label = (() => {
    switch (status) {
      case 'ready':
        return 'MCP 已连接';
      case 'connecting':
        return 'MCP 连接中…';
      case 'stopped':
        return 'MCP 未连接';
      default:
        return 'MCP 不可用';
    }
  })();

  const badgeStatus = (() => {
    switch (status) {
      case 'ready':
        return 'success' as const;
      case 'connecting':
        return 'warning' as const;
      case 'stopped':
        return 'error' as const;
      default:
        return 'default' as const;
    }
  })();

  return (
    <Tooltip title={label} placement="bottom">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
        <Badge status={badgeStatus} />
        <Typography.Text style={{ fontSize: 12, opacity: 0.85 }}>{label}</Typography.Text>
      </div>
    </Tooltip>
  );
}

