import React from 'react';
import { User, Bot } from 'lucide-react';
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
  const iconSize = size === 'sm' ? 16 : 18;
  const dim = size === 'sm' ? 28 : 32; // px

  const style: React.CSSProperties = {
    flexShrink: 0,
    borderRadius: 9999,
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    height: dim,
    width: dim,
    background: isUser
      ? 'linear-gradient(90deg, hsl(200 90% 60%), hsl(var(--color-primary)))'
      : 'hsla(0,0%,45%,0.7)'
  };

  return (
    <div style={style} className={className} aria-hidden>
      {isUser ? <User size={iconSize} /> : <Bot size={iconSize} />}
    </div>
  );
};

export default ChatAvatar;
