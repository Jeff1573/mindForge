// shadcn/ui Button 组件源码（精简版）
// 来源: https://ui.shadcn.com/ （已按项目需要做轻微裁剪）
// 说明: 我们采用 shadcn/ui 的源码策略，确保交互可访问性与风格一致性。

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  // ring-offset 使用语义背景，避免深色下出现白色描边
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white hover:bg-blue-600/90 shadow-sm',
        secondary: 'bg-neutral-900 text-white hover:bg-neutral-900/90',
        outline:
          'border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 shadow-sm',
        // 语义化 ghost：在深浅主题下均为轻度悬浮，不再使用固定的 neutral-100
        ghost: 'text-foreground/80 hover:text-foreground hover:bg-muted/70',
        link: 'text-blue-600 underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-[13px]',
        lg: 'h-10 px-8',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
    );
  }
);
Button.displayName = 'Button';
