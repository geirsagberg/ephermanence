import { useEffect, useRef, useState } from 'react';

export type DraftPosition = { x: number; y: number };

type SpatialThoughtComposerProps = {
  position: DraftPosition;
  initialText?: string;
  label?: string;
  prototypeVariant?: 'A' | 'B' | 'C';
  onCancel: () => void;
  onCreate: (text: string) => void;
};

export function SpatialThoughtComposer({
  position,
  initialText = '',
  label = 'New thought at this position',
  prototypeVariant,
  onCancel,
  onCreate,
}: SpatialThoughtComposerProps) {
  const [text, setText] = useState(initialText);
  const formRef = useRef<HTMLFormElement>(null);
  const savedRef = useRef(false);

  const create = () => {
    const next = text.trim();
    if (!next || savedRef.current) return;
    savedRef.current = true;
    onCreate(next);
  };

  useEffect(() => {
    const saveOnTapAway = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !formRef.current?.contains(target)) create();
    };
    window.addEventListener('pointerdown', saveOnTapAway, true);
    return () => window.removeEventListener('pointerdown', saveOnTapAway, true);
  });

  return (
    <form
      ref={formRef}
      className={`spatial-composer${prototypeVariant ? ` spatial-composer--${prototypeVariant.toLowerCase()}` : ''}`}
      style={{ left: position.x, top: position.y }}
      onSubmit={(event) => {
        event.preventDefault();
        create();
      }}
    >
      <textarea
        autoFocus
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
            create();
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
