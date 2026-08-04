import { useState } from 'react';

import { QuickCapture } from './components/QuickCapture';
import {
  SpatialThoughtComposer,
  type DraftPosition,
} from './components/SpatialThoughtComposer';
import { ThoughtSpace } from './components/ThoughtSpace';
import { initialSpace } from './initialSpace';
import type { SpaceState } from './types';

function Wordmark() {
  return (
    <div className="wordmark" aria-label="Spacephemeral">
      <span className="wordmark__orb" />
      <span>spacephemeral</span>
    </div>
  );
}

function StateReadout({ state }: { state: SpaceState }) {
  const joined = new Set(state.attachments.flat()).size;
  return (
    <p className="state-readout" aria-live="polite">
      {state.thoughts.length} thoughts · {joined} joined · {state.attachments.length}{' '}
      bonds
    </p>
  );
}

export function App() {
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [draftPosition, setDraftPosition] = useState<DraftPosition | null>(null);
  const [state, setState] = useState<SpaceState>(initialSpace);

  const createThought = (text: string, position?: DraftPosition) => {
    const nextThought = {
      id: `thought-${Date.now()}`,
      text,
      x: position?.x ?? 0.76,
      y: position?.y ?? 0.72,
      radius: Math.max(74, Math.min(96, 70 + text.length * 0.35)),
      tone: state.thoughts.length % 5,
    };
    setState((current) => ({ ...current, thoughts: [...current.thoughts, nextThought] }));
    setDraftPosition(null);
    setQuickCaptureOpen(false);
  };

  return (
    <>
      <main className="app-shell">
        <header className="app-header">
          <Wordmark />
          <button className="quiet-button" onClick={() => setQuickCaptureOpen(true)}>
            + Quick capture
          </button>
        </header>
        <ThoughtSpace
          state={state}
          onChange={setState}
          onCreateRequest={setDraftPosition}
          onEmptyClick={() => setDraftPosition(null)}
        />
        <div className="app-guidance">
          <span>Double-click empty space to add</span>
          <span className="guidance-dot" />
          <span>Shift-drag to move one</span>
        </div>
        <StateReadout state={state} />
      </main>
      {draftPosition && (
        <SpatialThoughtComposer
          position={draftPosition}
          onCancel={() => setDraftPosition(null)}
          onCreate={(text) => createThought(text, draftPosition)}
        />
      )}
      <QuickCapture
        open={quickCaptureOpen}
        onClose={() => setQuickCaptureOpen(false)}
        onCapture={createThought}
      />
    </>
  );
}
