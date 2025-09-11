import React from 'react';
import { cn } from '../../lib/utils';
import { ChatAvatar } from './ChatAvatar';

export type ChatRole = 'user' | 'assistant';

export interface MessageBubbleProps {
  role: ChatRole;
  text: string;
}

/**
 * MessageBubble: 消息气泡
 * - role === 'assistant' 使用灰色来消息样式
 * - role === 'user' 使用蓝色渐变样式
 * - 尖角通过伪元素实现（见 index.css 中 bubble-tail-*）
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({ role, text }) => {
  const isUser = role === 'user';
  return (
    <div
      className={cn(
        'grid w-full items-end gap-3 items-center',
        isUser ? 'grid-cols-[1fr_auto]' : 'grid-cols-[auto_1fr]'
      )}
    >
      {/* assistant: avatar | bubble ； user: bubble | avatar */}
      {isUser ? (
        <>
          <div className={cn('justify-self-end', 'bubble-out bubble-tail-out')}>
            <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
          </div>
          <ChatAvatar role={role} />
        </>
      ) : (
        <>
          <ChatAvatar role={role} />
          <div className={cn('justify-self-start', 'bubble-in bubble-tail-in')}>
            <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
          </div>
        </>
      )}
    </div>
  );
};
