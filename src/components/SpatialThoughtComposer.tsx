import type { CSSProperties } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { css } from '../../styled-system/css';

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
      className={composerClass}
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

const composerClass = css({
  position: 'fixed',
  zIndex: 10,
  display: 'grid',
  width: '210px',
  height: '210px',
  placeItems: 'center',
  padding: '38px 28px 30px',
  border: '1px solid rgb(255 255 255 / 70%)',
  borderRadius: '50%',
  background: 'color-mix(in srgb, var(--thought-tone) 96%, transparent)',
  boxShadow: '0 14px 38px rgb(62 67 61 / 10%)',
  transform: 'translate(-50%, -50%)',
  animation: 'composerBloom 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
  '& textarea': {
    width: '100%',
    height: '90px',
    padding: 0,
    border: 0,
    background: 'transparent',
    color: '#26312d',
    fontFamily: 'serif',
    fontSize: '18px',
    lineHeight: 1.18,
    textAlign: 'center',
    outline: 0,
    resize: 'none',
    '&::placeholder': {
      color: 'rgb(38 49 45 / 38%)',
    },
  },
});
