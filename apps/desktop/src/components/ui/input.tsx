// shadcn/ui Input 组件源码（精简版）
// 仅包含样式与基础可访问性，便于一致的表单控件风格。
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        // 使用语义基类，统一主题与尺寸/交互风格
        className={cn('input-base', className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
