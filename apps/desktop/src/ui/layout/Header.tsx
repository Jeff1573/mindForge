import React from 'react'
import { Button } from 'antd';
import { Menu } from 'lucide-react';
import { ThemeToggle } from '../system/ThemeToggle';
import { WindowControls } from '../system/WindowControls';

export default function Header() {
  return (
    <div className="mf-titlebar titlebar titlebar-surface ">
    <div className="titlebar-no-drag mf-show-mobile" style={{ paddingRight: '0.25rem' }}>
      <Button
        aria-label="打开菜单"
        type="text"
        className="window-btn"
        onClick={() => window.dispatchEvent(new Event('mf:toggleSidebar'))}
      >
        <Menu style={{ width: 16, height: 16 }} />
      </Button>
    </div>
    <div className="mf-titlebar-spacer" />
    <div className="mf-titlebar-actions">
      {/* <ThemeToggle /> */}
      <WindowControls />
    </div>
  </div>
  )
}
