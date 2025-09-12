import { type ClassValue } from 'clsx';
import { clsx } from 'clsx';

// 合并类名（已移除 tailwind-merge，纯 clsx 即可）
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
