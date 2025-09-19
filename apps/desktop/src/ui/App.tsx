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
  List,
  theme,
  ConfigProvider,
  message,
  Modal,
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
  StopOutlined,
} from '@ant-design/icons';
import Header from './layout/Header';
import AgentLogOutline from './agent/AgentLogOutline';
import FinalResultPanel from './agent/FinalResultPanel';
import type { AgentFinalResultEvent, AgentLogStep } from '@mindforge/shared';
import useAutoScroll from './hooks/useAutoScroll';

// 注：此组件仅展示 UI。与 Electron 主进程的实际交互（选择目录、生成报告）
// 需要你在 renderer 里通过 IPC 暴露方法，例如：window.api.selectDirectory() / window.api.generateReport(path)
// 下面提供了浏览器回退方案（webkitdirectory）以便在预览中演示。

export default function App() {
  // 基础状态：与原实现一致，仅替换 UI 呈现
  const [projectPath, setProjectPath] = useState<string>("");
  const [reportPath, setReportPath] = useState<string>("");

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
  // 当前运行的 runId（用于取消与事件过滤）
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // 日志容器 ref：用于自动滚动到底部（悬停暂停）
  const logBoxRefMain = useRef<HTMLDivElement>(null);
  const logBoxRefDemo = useRef<HTMLDivElement>(null);

  const canUseWebkitDir = useMemo(() => typeof document !== "undefined", []);
  const { token } = theme.useToken();

  // 尾随：当有新日志追加时自动滚动至底部；用户鼠标悬停时暂停。
  useAutoScroll(logBoxRefMain, [agentLogs.length]);
  useAutoScroll(logBoxRefDemo, [agentLogs.length]);

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
    if (!projectPath || agentLoading) return;
    if (!(window as any)?.api?.agent?.reactStart) {
      message.error('当前环境不支持 Agent 调用，请在 Electron 应用内使用');
      return;
    }
    // 构造用户提示词（按需求指定格式）
    const prompt = `使用Serena MCP 工具分析该项目${projectPath}的内容，并且生成基于该项目的内容大纲，返回markdown文本.`;
    setReportPath("");
    setAgentLoading(true);
    setAgentLogs(["[开始] 提交至主进程 agent:react:start…"]);
    setAgentSteps([]);
    setAgentFinal(undefined);
    let offStep: undefined | (() => void);
    let offFinal: undefined | (() => void);
    let offError: undefined | (() => void);
    try {
      const payload = { messages: [{ role: 'user', content: prompt }] } as const;
      const { runId } = await (window as any).api.agent.reactStart(payload as any);
      setCurrentRunId(runId);
      offStep = (window as any).api.agent.onReactStep(({ runId: rid, step }: any) => {
        if (rid !== runId) return; // 过滤其他运行的事件
        setAgentSteps((prev) => [...prev, step as any]);
        const head = step?.summary ?? `step#${String(step?.index ?? '?')} role=${String(step?.role ?? '?')}`;
        const calls = (() => { try { return step?.toolCalls ? ` toolCalls=${JSON.stringify(step.toolCalls)}` : ''; } catch { return ' toolCalls=[Unserializable]'; }})();
        setAgentLogs((prev) => [...prev, `${head} => ${String(step?.content ?? '')}${calls}`]);
      });
      offFinal = (window as any).api.agent.onReactFinal(async ({ runId: rid, result }: any) => {
        if (rid !== runId) return; // 过滤其他运行
        const final = result?.finalResult as AgentFinalResultEvent | undefined;
        setAgentFinal(final as any);
        setAgentLogs((prev) => [...prev, `systemPromptExcerpt: ${result?.systemPromptExcerpt ?? ''}`, '[完成]']);
        // 保存 Markdown 到项目 reports/
        try {
          if (final?.content && (window as any).api?.saveMarkdownReport) {
            const saveRes = await (window as any).api.saveMarkdownReport(projectPath, final.content);
            if (saveRes?.ok && saveRes.fullPath) {
              setReportPath(saveRes.fullPath);
              message.success('报告已创建');
              // 弹窗提示：报告生成成功
              try {
                Modal.success({
                  title: '报告已生成',
                  content: saveRes.fullPath,
                  okText: '查看所在文件夹',
                  onOk: () => {
                    try {
                      if ((window as any)?.api?.revealInFolder && saveRes.fullPath) {
                        (window as any).api.revealInFolder(saveRes.fullPath);
                      }
                    } catch { /* noop */ }
                  },
                });
              } catch { /* noop */ }
            } else {
              message.warning(`报告未写入：${saveRes?.message ?? '未知原因'}`);
            }
          }
        } catch (e) {
          message.error(`保存失败：${(e as Error)?.message ?? String(e)}`);
        }
        setAgentLoading(false);
        setCurrentRunId(null);
        try { offStep?.(); offFinal?.(); offError?.(); } catch {}
      });
      offError = (window as any).api.agent.onReactError(({ runId: rid, message: msg }: any) => {
        if (rid !== runId) return; // 过滤其他运行
        setAgentLogs((prev) => [...prev, `错误：${String(msg)}`]);
        message.error(String(msg));
        setAgentLoading(false);
        setCurrentRunId(null);
        try { offStep?.(); offFinal?.(); offError?.(); } catch {}
      });
    } catch (err) {
      setAgentLogs((prev) => [...prev, `错误：${(err as Error)?.message ?? String(err)}`]);
      message.error((err as Error)?.message ?? String(err));
      setAgentLoading(false);
      setCurrentRunId(null);
      try { offStep?.(); offFinal?.(); offError?.(); } catch {}
    }
  };

  // 终止当前运行：弹窗确认并通过 IPC 发起取消
  const handleCancel = async () => {
    if (!agentLoading || !currentRunId) return;
    Modal.confirm({
      title: '确认终止当前报告生成？',
      content: '终止后将保留已产生的进度与产物，你可以稍后重新执行。',
      okText: '终止',
      okButtonProps: { danger: true, icon: <StopOutlined /> as any },
      cancelText: '返回',
      onOk: async () => {
        try {
          setAgentLogs((prev) => [...prev, `已请求终止（runId=${currentRunId}）…`]);
          await (window as any).api?.agent?.reactCancel?.(currentRunId);
        } catch (e) {
          message.error(`终止失败：${(e as Error)?.message ?? String(e)}`);
        }
      },
    });
  };

  const handleCopy = async () => {
    if (!reportPath) return;
    try {
      await navigator.clipboard.writeText(reportPath);
      message.success('路径已复制');
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

            {/* ========== Agent 执行视图（新增：日志大纲 + 最终结果 + 原始日志） ========== */}
            <div>
              <Space size="small" align="center" style={{ marginBottom: 8 }}>
                <PlayCircleFilled style={{ color: '#2563eb' }} />
                <Typography.Text strong>Agent 执行</Typography.Text>
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
                <Divider type="vertical" style={{ margin: '0 8px' }} />
                <Space>
                  <Button
                    type="primary"
                    icon={agentLoading ? <LoadingOutlined /> : <PlayCircleFilled />}
                    loading={agentLoading}
                    onClick={handleGenerate}
                    disabled={!projectPath || agentLoading}
                  >
                    {agentLoading ? '执行中…' : '开始生成报告'}
                  </Button>
                  {agentLoading && (
                    <Button danger icon={<StopOutlined />} onClick={handleCancel}>
                      终止
                    </Button>
                  )}
                </Space>
              </Space>

              {/* 日志大纲（默认折叠） + 最终结果（Markdown） */}
              {outlineEnabled && <AgentLogOutline steps={agentSteps} defaultCollapsed />}
              {outlineEnabled && <FinalResultPanel final={agentFinal} />}

              {/* 原始日志列表（调试用途） */}
              <div
                style={{
                  border: `1px solid ${token.colorBorder}`,
                  borderRadius: token.borderRadiusLG,
                  padding: 12,
                  marginTop: 12,
                }}
              >
                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 6 }}>Agent 执行日志</div>
                {/* 自动滚动容器：当 agentLogs 追加时，若未悬停则瞬时滚动到底部 */}
                <div style={{ maxHeight: 240, overflow: 'auto' }} ref={logBoxRefMain}>
                  <List
                    size="small"
                    dataSource={agentLogs}
                    renderItem={(item) => <List.Item style={{ padding: '4px 0' }}>• {item}</List.Item>}
                  />
                </div>
              </div>
            </div>

            {/* 生成结果区：成功提示 + 操作（复制 / 打开文件夹） */}
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
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
        {/* 隐藏card */}
        <Card bodyStyle={{ padding: 24, marginTop: 16 }} className="security-card" style={{ display: 'none' }}>
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
              {/* 演示卡片内的同款日志容器（默认隐藏 display: none） */}
              <div style={{ maxHeight: 240, overflow: 'auto' }} ref={logBoxRefDemo}>
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
