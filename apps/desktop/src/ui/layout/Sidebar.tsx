import React from 'react';
import { Brain, MessageSquare, Settings, Power, User } from 'lucide-react';
import { Button } from '../../components/ui/button';
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
    <aside
      className="titlebar-drag shadow-glass sticky top-0 flex h-full w-16 flex-shrink-0 flex-col items-center justify-between self-start rounded-none bg-neutral-900/95 p-0 pb-3 sm:pb-4 text-white sm:w-20"
    >
      {/* 顶部 Header：着色且可拖拽 */}
      <div className="titlebar-drag flex h-10 w-full items-center justify-center border-b border-white/10 bg-neutral-800/80">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 overflow-hidden">
          <img src={appIconUrl} alt="MindForge" className="h-5 w-5 object-contain pointer-events-none z-0" />
        </div>
      </div>
      <div className="flex w-full flex-1 flex-col items-center gap-4 mt-2">
        {items.slice(0, 3).map((it) => (
          <SidebarItem key={it.key} icon={it.icon} active={active === it.key} onClick={() => setActive(it.key)} />
        ))}
      </div>
      <div className="mt-2 flex flex-col items-center gap-4">
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
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      onClick={onClick}
      className={cn(
        'titlebar-no-drag',
        'h-12 w-12 rounded-xl border border-white/10 bg-white/10 text-white hover:bg-white/20',
        active && 'bg-white text-neutral-900 hover:bg-white'
      )}
      aria-pressed={active}
    >
      <Icon className="h-6 w-6" />
      <span className="sr-only">nav</span>
    </Button>
  );
};
