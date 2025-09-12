import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Space, Typography, Progress, Alert, Checkbox, Input } from 'antd';

type FileRecord = {
  rel_path: string;
  abs_path?: string;
  size: number;
  mtime_ms: number;
  binary: boolean;
};

type ProgressEvent = {
  task_id: string;
  scanned: number;
  emitted: number;
  binary: number;
  current?: string;
  started_at_ms: number;
  elapsed_ms: number;
};

type DoneEvent = {
  task_id: string;
  total: number;
  text: number;
  binary: number;
  skipped: number;
  duration_ms: number;
  sample: FileRecord[];
};

type ErrorEvent = { task_id: string; message: string; path?: string };

export default function IndexerPage() {
  const [root, setRoot] = useState<string>('');
  const [taskId, setTaskId] = useState<string>('');
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [done, setDone] = useState<DoneEvent | null>(null);
  const [error, setError] = useState<ErrorEvent | null>(null);
  const [respectGitignore, setRespectGitignore] = useState(true);
  const [followSymlinks, setFollowSymlinks] = useState(false);
  const [absolute, setAbsolute] = useState(false);
  const [extraIgnore, setExtraIgnore] = useState<string>('');
  const listeningRef = useRef(false);

  // 中文注释：Tauri API 已移除。待后续以 Electron 子进程与 IPC 替代。
  useEffect(() => {
    listeningRef.current = true;
    return () => {
      listeningRef.current = false;
    };
  }, []);

  const onPick = useCallback(async () => {
    // 迁移期占位：可通过输入框手动填写路径
  }, []);

  const onStart = useCallback(async () => {
    // 迁移期占位：后续通过 window.api 调用主进程启动索引
  }, []);

  const onCancel = useCallback(async () => {
    // 迁移期占位：后续通过 window.api 取消索引
  }, []);

  const percent = useMemo(() => {
    if (!progress) return 0;
    // 没有总量，这里仅以扫描数进行对数映射占位
    return Math.min(99, Math.floor(Math.log10(progress.scanned + 1) * 25));
  }, [progress]);

  return (
    <div style={{ padding: 16 }}>
      <Typography.Title level={4}>项目解析</Typography.Title>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert type="info" message="索引器功能迁移中：Tauri API 已移除，将在 Electron 子进程中提供等价能力。" showIcon />
        {error && <Alert type="error" message={error.message} showIcon />}
        <Space>
          <Button onClick={onPick} disabled>
            选择目录（迁移中）
          </Button>
          <Typography.Text type={root ? 'success' : 'secondary'}>{root || '未选择'}</Typography.Text>
        </Space>
        <Space wrap>
          <Checkbox checked={respectGitignore} onChange={(e) => setRespectGitignore(e.target.checked)}>
            合并 .gitignore
          </Checkbox>
          <Checkbox checked={followSymlinks} onChange={(e) => setFollowSymlinks(e.target.checked)}>
            跟随符号链接
          </Checkbox>
          <Checkbox checked={absolute} onChange={(e) => setAbsolute(e.target.checked)}>
            回传绝对路径
          </Checkbox>
        </Space>
        <div>
          <Typography.Text>额外忽略（每行一条，支持 Gitignore 语法）</Typography.Text>
          <Input.TextArea value={extraIgnore} onChange={(e) => setExtraIgnore(e.target.value)} rows={3} />
        </div>
        <Space>
          <Button type="primary" onClick={onStart} disabled>
            开始解析（迁移中）
          </Button>
          <Button danger onClick={onCancel} disabled>
            取消
          </Button>
        </Space>
        <div>
          <Progress percent={percent} />
          {progress?.current && (
            <Typography.Text type="secondary">当前：{progress.current}</Typography.Text>
          )}
        </div>
        {done && (
          <div>
            <Alert
              type="success"
              showIcon
              message={`完成：共 ${done.total} 个，文本 ${done.text}，二进制 ${done.binary}，耗时 ${done.duration_ms} ms`}
            />
            <div style={{ marginTop: 8 }}>
              <Typography.Text>样本：</Typography.Text>
              <ul>
                {done.sample.map((r) => (
                  <li key={r.rel_path}>{r.rel_path}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Space>
    </div>
  );
}


