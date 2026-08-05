import type { CSSProperties } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type DraftPosition = { x: number; y: number };

type SpatialThoughtComposerProps = {
  position: DraftPosition;
  initialText?: string;
  label?: string;
  onCancel: () => void;
  onKeep: (text: string) => void;
  toneColor: string;
};

export function SpatialThoughtComposer({
  position,
  initialText = '',
  label = 'New thought at this position',
  onCancel,
  onKeep,
  toneColor,
}: SpatialThoughtComposerProps) {
  const [text, setText] = useState(initialText);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedRef = useRef(false);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }, []);

  const keep = useCallback(() => {
    const next = text.trim();
    if (!next || savedRef.current) return;
    savedRef.current = true;
    onKeep(next);
  }, [onKeep, text]);

  useEffect(() => {
    const saveOnTapAway = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !formRef.current?.contains(target)) keep();
    };
    window.addEventListener('pointerdown', saveOnTapAway, true);
    return () => window.removeEventListener('pointerdown', saveOnTapAway, true);
  }, [keep]);

  return (
    <form
      ref={formRef}
      className="spatial-composer"
      style={
        {
          left: position.x,
          top: position.y,
          '--thought-tone': toneColor,
        } as CSSProperties & Record<'--thought-tone', string>
      }
      onSubmit={(event) => {
        event.preventDefault();
        keep();
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            keep();
          }
        }}
        placeholder="A thought…"
        maxLength={220}
        rows={4}
        aria-label={label}
      />
    </form>
  );
}
