import { useEffect, useRef, useState } from 'react';

type QuickCaptureProps = {
  open: boolean;
  onClose: () => void;
  onCapture: (text: string) => void;
};

export function QuickCapture({ open, onClose, onCapture }: QuickCaptureProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const next = text.trim();
    if (!next) return;
    onCapture(next);
    setText('');
  };

  return (
    <div className="capture" role="dialog" aria-modal="true" aria-label="Quick capture">
      <button className="capture__close" onClick={onClose} aria-label="Close capture">
        Close
      </button>
      <form
        className="capture__form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="eyebrow">Catch it while it is here</p>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') submit();
            if (event.key === 'Escape') onClose();
          }}
          placeholder="What are you thinking?"
          maxLength={220}
          rows={3}
        />
        <div className="capture__footer">
          <span>{text.length}/220</span>
          <button type="submit" disabled={!text.trim()}>
            Keep thought
          </button>
        </div>
      </form>
    </div>
  );
}
