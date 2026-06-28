import { useRef, useEffect } from 'react';

type Props = {
  isOpen: boolean;
  value: string;
  error: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
};

export const InlineIdInput = ({
  isOpen,
  value,
  error,
  onChange,
  onSubmit,
  onCancel,
  placeholder = 'Enter ID…',
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) onSubmit();
    else if (e.key === 'Escape') onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="inline-input-wrapper">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="inline-id-input"
      />
      {error && <div className="inline-error">{error}</div>}
    </div>
  );
};
