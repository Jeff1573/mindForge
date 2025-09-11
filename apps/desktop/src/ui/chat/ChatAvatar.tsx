import React from 'react';
import { User, Bot } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ChatRole } from './MessageBubble';

export interface ChatAvatarProps {
  role: ChatRole;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * ChatAvatar: 通用圆形头像
 * - assistant：中性色圆形底 + 机器人图标
 * - user：蓝色渐变圆形底 + 用户图标
 */
export const ChatAvatar: React.FC<ChatAvatarProps> = ({ role, size = 'md', className }) => {
  const isUser = role === 'user';
  const base = 'shrink-0 rounded-full text-white grid place-items-center';
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 16 : 18;

  const bg = isUser
    ? 'bg-gradient-to-r from-sky-400 to-blue-600'
    : 'bg-neutral-400/70 dark:bg-neutral-500/80';

  return (
    <div className={cn(base, dim, bg, className)} aria-hidden>
      {isUser ? <User size={iconSize} /> : <Bot size={iconSize} />}
    </div>
  );
};

export default ChatAvatar;

