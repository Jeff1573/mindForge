import React from 'react';
import { ChatSurface } from './ChatSurface';
import { WindowControls } from '../system/WindowControls';
import { ThemeToggle } from '../system/ThemeToggle';
import { Button } from 'antd';
import { Menu } from 'lucide-react';
import { MessageList, type Message } from './MessageList';
import { ChatInput } from './ChatInput';

const demoMessages: Message[] = [
  { id: 'm1', role: 'assistant', text: 'The weather in the York is 75°F sunny.' },
  { id: 'm2', role: 'user', text: 'Tell me a joke.' },
  { id: 'm3', role: 'user', text: "What's a weather today?" },
  { id: 'm4', role: 'assistant', text: 'Why did the scarecrow win award? Because he outstanding in a field!' },
  { id: 'm5', role: 'assistant', text: 'How about roasted chicken with rosemary and lemon.' }
];

export const ChatPanel: React.FC = () => {
  const [messages, setMessages] = React.useState<Message[]>(demoMessages);

  const onSend = (text: string) => {
    setMessages((arr) => [...arr, { id: crypto.randomUUID(), role: 'user', text }]);
  };

  return (
    <ChatSurface>
      {/* Header：左侧为拖拽区；移动端提供汉堡按钮；右侧为主题与窗口控制（禁止拖拽） */}
      <div className="mf-titlebar titlebar titlebar-surface">
        <div className="titlebar-no-drag mf-show-mobile" style={{ paddingRight: '0.25rem' }}>
          <Button
            aria-label="打开菜单"
            type="text"
            className="window-btn"
            onClick={() => window.dispatchEvent(new Event('mf:toggleSidebar'))}
          >
            <Menu style={{ width: 16, height: 16 }} />
          </Button>
        </div>
        <div className="mf-titlebar-spacer" />
        <div className="mf-titlebar-actions">
          <ThemeToggle />
          <WindowControls />
        </div>
      </div>
      {/* 主体区：消息列表 + 输入，加入内边距 */}
      <div className="mf-chat-body">
        <MessageList messages={messages} />
        <ChatInput onSend={onSend} />
      </div>
    </ChatSurface>
  );
};
