import React from 'react';
import { ChatSurface } from './ChatSurface';
import { WindowControls } from '../system/WindowControls';
import { ThemeToggle } from '../system/ThemeToggle';
import { Button } from '../../components/ui/button';
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
      <div className={['w-full shrink-0', 'titlebar titlebar-surface px-2 flex items-center'].join(' ')}>
        <div className="titlebar-no-drag md:hidden pr-1">
          <Button
            aria-label="打开菜单"
            size="icon"
            variant="ghost"
            className="window-btn"
            onClick={() => window.dispatchEvent(new Event('mf:toggleSidebar'))}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
        <div className="titlebar-drag h-full flex-1" />
        <div className="titlebar-no-drag -mr-1 flex items-center gap-1">
          <ThemeToggle />
          <WindowControls />
        </div>
      </div>
      {/* 主体区：消息列表 + 输入，加入内边距 */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4 pr-3 sm:pr-4">
        <MessageList messages={messages} />
        <ChatInput onSend={onSend} />
      </div>
    </ChatSurface>
  );
};
