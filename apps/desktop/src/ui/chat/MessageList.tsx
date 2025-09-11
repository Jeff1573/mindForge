import React from 'react';
import { ScrollArea } from '../../components/ui/scroll-area';
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
    <div className="flex-1 min-h-0 overflow-hidden">
      <ScrollArea className="h-full pr-2 sm:pr-4">
        <div className="space-y-3 pl-0 pr-1 py-2 sm:space-y-4 sm:pr-2">
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} text={m.text} />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
};
