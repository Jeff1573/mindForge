import React from 'react';
import { ChatSurface } from './ChatSurface';
import { WindowControls } from '../system/WindowControls';
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
      {/* Header：左侧为拖拽区，右侧为窗口控制（禁止拖拽） */}
      <div
        className={[
          'w-full',
          'h-9 sm:h-10 shrink-0 rounded-t-xl',
          'bg-gradient-to-b from-neutral-100/80 to-neutral-50/60',
          'dark:from-neutral-900/80 dark:to-neutral-800/60',
          'backdrop-blur-sm border-b border-black/10 dark:border-white/10',
          'flex items-center justify-between px-2'
        ].join(' ')}
      >
        <div className="titlebar-drag h-full flex-1" />
        <div className="titlebar-no-drag -mr-1">
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
