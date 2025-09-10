import { type ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// 合并 Tailwind 类名：与 shadcn/ui 模板一致
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

