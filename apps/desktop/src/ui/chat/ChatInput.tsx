import React from 'react';
import { Button, Input } from 'antd';
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
    <form onSubmit={handleSubmit} className="mf-chat-input">
      <Input.TextArea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Type your message..."
        disabled={disabled}
        autoSize={{ minRows: 1, maxRows: 8 }}
        size="large"
        className="flex-1"
      />
      <Button type="primary" size="large" htmlType="submit" disabled={disabled || value.trim().length === 0} className="gap-2">
        <SendHorizonal style={{ width: 16, height: 16 }} />
        Send
      </Button>
    </form>
  );
};
