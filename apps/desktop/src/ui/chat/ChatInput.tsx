import React from 'react';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { SendHorizonal } from 'lucide-react';

export interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

/**
 * ChatInput: 输入区
 * - Enter 发送，Shift+Enter 换行
 * - 右侧发送按钮
 */
export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [value, setValue] = React.useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue('');
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex items-end gap-2 sm:gap-3">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type your message..."
        disabled={disabled}
        className="min-h-12 max-h-40 flex-1 resize-y"
      />
      <Button type="submit" disabled={disabled || value.trim().length === 0} className="gap-2">
        <SendHorizonal className="h-4 w-4" />
        Send
      </Button>
    </form>
  );
};
