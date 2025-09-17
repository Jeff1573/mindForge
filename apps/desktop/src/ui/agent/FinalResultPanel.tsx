import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Button, Card, Space, Typography, message } from 'antd';
import type { AgentFinalResultEvent } from '@mindforge/shared';

type Props = { final?: AgentFinalResultEvent };

/**
 * FinalResultPanel：LLM 最终结果（Markdown 完整展示，不折叠）。
 */
export default function FinalResultPanel({ final }: Props) {
  if (!final?.content) return null;
  return (
    <Card size="small" style={{ marginTop: 12 }} bodyStyle={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Text strong>Final Result</Typography.Text>
        <Space size={8}>
          <Button size="small" onClick={async () => {
            try { await navigator.clipboard.writeText(final.content); message.success('已复制'); } catch {}
          }}>复制</Button>
        </Space>
      </div>
      <div style={{ marginTop: 8 }}>
        <ReactMarkdown>{final.content}</ReactMarkdown>
      </div>
    </Card>
  );
}
