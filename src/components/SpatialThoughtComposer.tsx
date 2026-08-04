import { useState } from 'react';

export type DraftPosition = { x: number; y: number };

type SpatialThoughtComposerProps = {
  position: DraftPosition;
  onCancel: () => void;
  onCreate: (text: string) => void;
};

export function SpatialThoughtComposer({
  position,
  onCancel,
  onCreate,
}: SpatialThoughtComposerProps) {
  const [text, setText] = useState('');

  const create = () => {
    const next = text.trim();
    if (next) onCreate(next);
  };

  return (
    <form
      className="spatial-composer"
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
        aria-label="New thought at this position"
      />
      <span>enter keep · esc cancel</span>
    </form>
  );
}
