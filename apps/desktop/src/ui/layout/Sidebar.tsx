import React from 'react';
import { Brain, MessageSquare, Settings, Power, User } from 'lucide-react';
import { Button } from 'antd';
import { cn } from '../../lib/utils';
// 使用 ESM 方式解析资源，避免相对路径层级错误
const appIconUrl = new URL('../../../assets/icon.svg', import.meta.url).href;

type NavKey = 'assistant' | 'chats' | 'settings' | 'power' | 'user';

const items: { key: NavKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'assistant', label: 'AI Assistant', icon: Brain },
  { key: 'chats', label: 'Chats', icon: MessageSquare },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'power', label: 'Power', icon: Power },
  { key: 'user', label: 'User', icon: User }
];

export const Sidebar: React.FC = () => {
  const [active, setActive] = React.useState<NavKey>('assistant');
  return (
    <aside className="mf-sidebar">
      {/* 顶部 Header：着色且可拖拽 */}
      <div className="mf-sidebar-header titlebar-surface">
        <div style={{ display: 'flex', height: '1.75rem', width: '1.75rem', alignItems: 'center', justifyContent: 'center', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <img src={appIconUrl} alt="MindForge" style={{ height: '1.25rem', width: '1.25rem', objectFit: 'contain', pointerEvents: 'none' }} />
        </div>
      </div>
      <div className="mf-sidebar-main">
        {items.slice(0, 3).map((it) => (
          <SidebarItem key={it.key} icon={it.icon} active={active === it.key} onClick={() => setActive(it.key)} />
        ))}
      </div>
      <div className="mf-sidebar-footer">
        {items.slice(3).map((it) => (
          <SidebarItem key={it.key} icon={it.icon} active={active === it.key} onClick={() => setActive(it.key)} />
        ))}
      </div>
    </aside>
  );
};

const SidebarItem: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
}> = ({ icon: Icon, active, onClick }) => {
  return (
    <Button
      type="text"
      onClick={onClick}
      className={cn('mf-sidebar-btn btn-ghost', active && 'active')}
      aria-pressed={active}
    >
      <Icon style={{ width: 24, height: 24 }} />
      <span className="sr-only">nav</span>
    </Button>
  );
};
