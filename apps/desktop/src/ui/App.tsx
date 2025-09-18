import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
// antd 组件与图标（替换 Tailwind 呈现层）
import {
  Typography,
  Card,
  Space,
  Input,
  Button,
  Divider,
  Progress,
  List,
  theme,
  ConfigProvider,
} from 'antd';
import { Switch } from 'antd';
import {
  FolderOpenOutlined,
  FileDoneOutlined,
  PlayCircleFilled,
  CheckCircleFilled,
  LoadingOutlined,
  CopyOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import Header from './layout/Header';
import AgentLogOutline from './agent/AgentLogOutline';
import FinalResultPanel from './agent/FinalResultPanel';
import type { AgentFinalResultEvent, AgentLogStep } from '@mindforge/shared';

// 注：此组件仅展示 UI。与 Electron 主进程的实际交互（选择目录、生成报告）
// 需要你在 renderer 里通过 IPC 暴露方法，例如：window.api.selectDirectory() / window.api.generateReport(path)
// 下面提供了浏览器回退方案（webkitdirectory）以便在预览中演示。

export default function App() {
  // 基础状态：与原实现一致，仅替换 UI 呈现
  const [projectPath, setProjectPath] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reportPath, setReportPath] = useState<string>("");
  const [log, setLog] = useState<string[]>([]);

  // ========== Agent 最小可行测试界面状态 ==========
  // 为何：用于最小化验证主进程 IPC `agent:react:invoke`。
  // 约束：非流式，仅展示一次性返回内容与步骤；错误写入日志。
  // 边界：不做会话复用与历史持久化。
  const [agentPrompt, setAgentPrompt] = useState<string>('');
  const [agentLoading, setAgentLoading] = useState<boolean>(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [agentSteps, setAgentSteps] = useState<AgentLogStep[]>([]);
  const [agentFinal, setAgentFinal] = useState<AgentFinalResultEvent | undefined>(undefined);
  const [outlineEnabled, setOutlineEnabled] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUseWebkitDir = useMemo(() => typeof document !== "undefined", []);
  const { token } = theme.useToken();

  // 首屏：从 localStorage 恢复上次选择
  useEffect(() => {
    try {
      const cached = localStorage.getItem('mf.selectedDirectoryPath');
      if (cached) setProjectPath(cached);
    } catch { /* noop */ }
  }, []);

  // 实验性灰度开关：结构化日志视图开关（默认开启）
  useEffect(() => {
    try {
      const v = localStorage.getItem('mf.agentLogOutline.enabled');
      if (v === '0' || v === 'false') setOutlineEnabled(false);
      else setOutlineEnabled(true);
    } catch { /* noop */ }
  }, []);

  const handleChooseDir = async () => {
    // 优先：Electron IPC 方式；若存在该 API，无论选择或取消，都不触发浏览器回退
    try {
      if (window?.api?.selectDirectory) {
        const result = await window.api.selectDirectory(); // 应返回字符串路径或 null（取消）
        if (typeof result === "string" && result.length) {
          setProjectPath(result);
          try { localStorage.setItem('mf.selectedDirectoryPath', result); } catch { /* noop */ }
        }
        return; // 关键：存在 IPC 时直接返回，避免取消后弹出第二次选择
      }
    } catch (e) {
      console.warn(e);
      // 出错时也返回，避免二次弹窗造成困扰
      return;
    }
    // 仅当不存在 IPC API（例如浏览器预览环境）时，使用回退方案
    fileInputRef.current?.click();
  };

  const handleFakeDirPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // 取第一个文件/目录的相对路径的最顶层目录名称作为展示
    const first = files[0];
    const webkitRelativePath = first?.webkitRelativePath || first?.name;
    const topLevel = webkitRelativePath?.split("/")?.[0] || first?.name || "已选择目录";
    const value = `(预览) ${topLevel}`;
    setProjectPath(value);
    try { localStorage.setItem('mf.selectedDirectoryPath', value); } catch { /* noop */ }
  };

  const handleClear = () => {
    setProjectPath("");
    try { localStorage.removeItem('mf.selectedDirectoryPath'); } catch { /* noop */ }
  };

  const handleGenerate = async () => {
    if (!projectPath || isGenerating) return;
    setIsGenerating(true);
    setReportPath("");
    setProgress(0);
    setLog(["开始生成报告…"]);

    // 如果你有真实后端逻辑，可以替换为 IPC 调用：
    // const out = await window.api.generateReport(projectPath)
    // setReportPath(out.path)

    // 预览里做个假进度
    const steps = [
      "解析项目结构",
      "索引与检索代码",
      "分析潜在风险点",
      "汇总并生成报告",
    ];
    for (let i = 0; i < steps.length; i++) {
      await new Promise((r) => setTimeout(r, 600));
      setProgress(Math.round(((i + 1) / steps.length) * 100));
      setLog((prev) => [...prev, steps[i]]);
    }

    const fakePath = `${projectPath}/reports/security-report-${Date.now()}.md`;
    setReportPath(fakePath);
    setIsGenerating(false);
    setLog((prev) => [...prev, "完成！"]);
  };

  const handleCopy = async () => {
    if (!reportPath) return;
    try {
      await navigator.clipboard.writeText(reportPath);
      setLog((prev) => [...prev, "报告路径已复制到剪贴板"]);
    } catch { /* noop */ }
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          // 局部页面采用清新的绿色主色，贴合设计图
          colorPrimary: 'hsl(160 84% 39%)',
        },
      }}
    >
    <div className="security-app">
      <Header />
      <div className="security-app-content">
        {/* 顶部标题区：图标 + 文案 */}
      <div className="security-wrap">
        <Space size="middle" align="center">
          <div
            aria-hidden
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(16,185,129,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileDoneOutlined style={{ fontSize: 20, color: '#059669' }} />
          </div>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              项目安全报告生成器
            </Typography.Title>
            <Typography.Text type="secondary">选择一个项目目录，一键生成扫描报告。简洁 · 清新</Typography.Text>
          </div>
        </Space>
      </div>

      {/* 主内容卡片 */}
      <div className="security-content">
        <Card bodyStyle={{ padding: 24 }} className="security-card">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* 选择目录 */}
            <div>
              <Space size="small" align="center" style={{ marginBottom: 8 }}>
                <FolderOpenOutlined style={{ color: '#059669' }} />
                <Typography.Text strong>选择项目目录</Typography.Text>
              </Space>

              {/* 网格布局：输入框 + 按钮 */}
              {/* 选择目录区：优先走 Electron IPC（window.api.selectDirectory），
                  若不可用则触发隐藏的 <input type="file" webkitdirectory> 回退。 */}
                <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: projectPath ? '1fr auto auto' : '1fr auto',
                  gap: 12,
                }}
              >
                <Input
                  readOnly
                  value={projectPath}
                  placeholder="未选择目录"
                  size="middle"
                />
                <Button
                  type="primary"
                  icon={<FolderOpenOutlined />}
                  onClick={handleChooseDir}
                >
                  {projectPath ? '更改目录' : '选择目录'}
                </Button>
                {projectPath && (
                  <Button onClick={handleClear}>清除</Button>
                )}
              </div>

              {/* 浏览器预览隐藏输入（回退方案，仅演示环境用于获取目录名）： */}
              {canUseWebkitDir && (
                <input
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  type="file"
                  // @ts-expect-error Chromium 非标准属性，用于目录选择回退
                  webkitdirectory="true"
                  onChange={handleFakeDirPick}
                />
              )}
            </div>

            <Divider style={{ margin: '8px 0 0' }} />

            {/* 生成报告区：保持原有假进度逻辑，仅替换为 antd 组件 */}
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography.Text type="secondary">输出格式：Markdown（.md）</Typography.Text>
                <Button
                  type="primary"
                  icon={isGenerating ? <LoadingOutlined /> : <PlayCircleFilled />}
                  loading={isGenerating}
                  onClick={handleGenerate}
                  disabled={!projectPath}
                >
                  {isGenerating ? '正在生成…' : '开始生成报告'}
                </Button>
              </div>

              {/* 进度条区块：展示当前 percent，关键信息在 progress 状态 */}
              <div
                style={{
                  border: `1px solid ${token.colorBorder}`,
                  borderRadius: token.borderRadiusLG,
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: token.colorTextTertiary, marginBottom: 6 }}>
                  <span>进度</span>
                  <span>{progress}%</span>
                </div>
                <Progress percent={progress} showInfo={false} />
              </div>

              {/* 日志区块：限制高度可滚动 */}
              <div
                style={{
                  border: `1px solid ${token.colorBorder}`,
                  borderRadius: token.borderRadiusLG,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }}>过程日志</div>
                <div style={{ maxHeight: 120, overflow: 'auto' }}>
                  <List
                    size="small"
                    dataSource={log}
                    renderItem={(item) => <List.Item style={{ padding: '4px 0' }}>• {item}</List.Item>}
                  />
                </div>
              </div>

              {/* 结果卡片：成功提示 + 操作（复制 / 打开文件夹） */}
              {reportPath && (
                <div
                  style={{
                    border: `1px solid ${token.colorSuccessBorder}`,
                    background: token.colorSuccessBg,
                    borderRadius: token.borderRadiusLG,
                    padding: 16,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 18, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <Typography.Text strong style={{ color: token.colorSuccess }}>
                      报告已生成
                    </Typography.Text>
                    <div style={{ marginTop: 6, fontSize: 12, wordBreak: 'break-all', color: token.colorText }}>
                      {reportPath}
                    </div>
                    <Space size="small" style={{ marginTop: 12 }}>
                      <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
                        复制路径
                      </Button>
                      <Button
                        size="small"
                        icon={<ExportOutlined />}
                        onClick={() => {
                          if (window?.api?.revealInFolder && reportPath) {
                            window.api.revealInFolder(reportPath);
                          }
                        }}
                      >
                        打开所在文件夹
                      </Button>
                    </Space>
                  </div>
                </div>
              )}
            </Space>
          </Space>
        </Card>

        {/* ========== Agent 测试卡片（最小可行） ========== */}
        <Card bodyStyle={{ padding: 24, marginTop: 16 }} className="security-card">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Space size="small" align="center" style={{ marginBottom: 8 }}>
                <PlayCircleFilled style={{ color: '#2563eb' }} />
                <Typography.Text strong>Agent 测试（调用 agent:react:invoke）</Typography.Text>
                <div style={{ flex: 1 }} />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>结构化视图</Typography.Text>
                <Switch
                  size="small"
                  checked={outlineEnabled}
                  onChange={(v) => {
                    setOutlineEnabled(v);
                    try { localStorage.setItem('mf.agentLogOutline.enabled', v ? '1' : '0'); } catch { /* noop */ }
                  }}
                />
              </Space>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                输入一段提示词，点击“执行”后在下方查看 Agent 的执行步骤与最终回复。
              </Typography.Paragraph>
              <Input.TextArea
                value={agentPrompt}
                onChange={(e) => setAgentPrompt(e.target.value)}
                autoSize={{ minRows: 3, maxRows: 6 }}
                placeholder="例如：请概述本应用内 Agent 的组成并给出 3 条改进建议"
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button
                  type="primary"
                  icon={agentLoading ? <LoadingOutlined /> : <PlayCircleFilled />}
                  loading={agentLoading}
                  onClick={async () => {
                    if (!agentPrompt?.trim() || agentLoading) return;
                    setAgentLoading(true);
                    setAgentLogs(["[开始] 提交至主进程 agent:react:start…"]);
                    setAgentSteps([]);
                    setAgentFinal(undefined);
                    let offStep: undefined | (() => void);
                    let offFinal: undefined | (() => void);
                    let offError: undefined | (() => void);
                    try {
                      const payload = { messages: [{ role: 'user', content: agentPrompt.trim() }] } as const;
                      const { runId } = await window.api.agent.reactStart(payload as any);
                      offStep = window.api.agent.onReactStep(({ step }) => {
                        setAgentSteps((prev) => [...prev, step as any]);
                        const head = step?.summary ?? `step#${String(step?.index ?? '?')} role=${String(step?.role ?? '?')}`;
                        const calls = (() => { try { return step?.toolCalls ? ` toolCalls=${JSON.stringify(step.toolCalls)}` : ''; } catch { return ' toolCalls=[Unserializable]'; }})();
                        setAgentLogs((prev) => [...prev, `${head} => ${String(step?.content ?? '')}${calls}`]);
                      });
                      offFinal = window.api.agent.onReactFinal(({ result }) => {
                        setAgentFinal(result?.finalResult as any);
                        setAgentLogs((prev) => [...prev, `systemPromptExcerpt: ${result?.systemPromptExcerpt ?? ''}`, '[完成]']);
                        setAgentLoading(false);
                        try { offStep?.(); offFinal?.(); offError?.(); } catch {}
                      });
                      offError = window.api.agent.onReactError(({ message }) => {
                        setAgentLogs((prev) => [...prev, `错误：${String(message)}`]);
                        setAgentLoading(false);
                        try { offStep?.(); offFinal?.(); offError?.(); } catch {}
                      });
                    } catch (err) {
                      setAgentLogs((prev) => [...prev, `错误：${(err as Error)?.message ?? String(err)}`]);
                      setAgentLoading(false);
                      try { offStep?.(); offFinal?.(); offError?.(); } catch {}
                    }
                  }}
                >
                  {agentLoading ? '执行中…' : '执行'}
                </Button>
              </div>
            </div>

            {/* 日志大纲（默认折叠） + 最终结果（Markdown） */}
            {outlineEnabled && <AgentLogOutline steps={agentSteps} defaultCollapsed />}
            {outlineEnabled && <FinalResultPanel final={agentFinal} />}

            {/* 原始日志列表（调试用途） */}
            <div
              style={{
                border: `1px solid ${token.colorBorder}`,
                borderRadius: token.borderRadiusLG,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }}>Agent 执行日志</div>
              <div style={{ maxHeight: 240, overflow: 'auto' }}>
                <List
                  size="small"
                  dataSource={agentLogs}
                  renderItem={(item) => <List.Item style={{ padding: '4px 0' }}>• {item}</List.Item>}
                />
              </div>
            </div>
          </Space>
        </Card>

        {/* 小贴士 */}
        <Typography.Paragraph className="security-footer-tip" type="secondary">
          {/* 提示：将选择目录与生成报告逻辑接入 */}
        </Typography.Paragraph>
      </div>
      </div>
    </div>
    </ConfigProvider>
  );
}
