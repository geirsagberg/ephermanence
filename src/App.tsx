import { useState } from 'react';

import { QuickCapture } from './components/QuickCapture';
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
  const [captureOpen, setCaptureOpen] = useState(false);
  const [state, setState] = useState<SpaceState>(initialSpace);

  const capture = (text: string) => {
    const count = state.thoughts.length;
    const nextThought = {
      id: `thought-${Date.now()}`,
      text,
      x: 0.76,
      y: 0.72,
      radius: Math.max(74, Math.min(96, 70 + text.length * 0.35)),
      tone: count % 5,
    };
    setState((current) => ({ ...current, thoughts: [...current.thoughts, nextThought] }));
    setCaptureOpen(false);
  };

  return (
    <>
      <main className="app-shell">
        <header className="app-header">
          <Wordmark />
          <button className="quiet-button" onClick={() => setCaptureOpen(true)}>
            + Quick capture
          </button>
        </header>
        <ThoughtSpace state={state} onChange={setState} />
        <div className="app-guidance">
          <span>Touch and release to join</span>
          <span className="guidance-dot" />
          <span>Shift-drag to move one</span>
        </div>
        <StateReadout state={state} />
      </main>
      <QuickCapture
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCapture={capture}
      />
    </>
  );
}
