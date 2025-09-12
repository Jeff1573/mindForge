import React from 'react';
import { MessageBubble, type ChatRole } from './MessageBubble';

export interface Message {
  id: string;
  role: ChatRole;
  text: string;
  ts?: number;
}

export const MessageList: React.FC<{ messages: Message[] }> = ({ messages }) => {
  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  return (
    <div className="mf-msg-wrap">
      {/* 原 Radix ScrollArea 替换为原生滚动容器，滚动条样式由全局 CSS 控制 */}
      <div className="mf-msg-scroll">
        <div className="mf-msg-list">
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} text={m.text} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};
