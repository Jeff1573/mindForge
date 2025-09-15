import React from 'react'
import { Button, theme } from 'antd'
import { Menu } from 'lucide-react'
import { WindowControls } from '../system/WindowControls'

export default function Header() {
  // 使用 antd 主题 Token，使标题栏背景与 App 主题一致
  const { token } = theme.useToken()
  return (
    <div
      className="mf-titlebar titlebar titlebar-surface"
      // 背景采用主题的浅主色背景，底部分隔线使用主题边框色
      style={{
        background: token.colorPrimaryBg,
        borderBottom: `1px solid ${token.colorBorder}`,
      }}
    >
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

