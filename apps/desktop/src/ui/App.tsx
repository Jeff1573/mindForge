import React from 'react';
import { Button } from '../components/ui/button';

export function App() {
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-2xl font-semibold">MindForge</h1>
      <p>桌面端已就绪（Tauri + Vite + React + Tailwind + shadcn）。</p>
      <div className="flex gap-2">
        <Button>默认按钮</Button>
        <Button variant="outline">描边按钮</Button>
        <Button variant="ghost">幽灵按钮</Button>
      </div>
    </div>
  );
}
