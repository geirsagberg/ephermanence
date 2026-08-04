import { useState } from 'react';

import { PrototypeSwitcher, type VariantKey } from './components/PrototypeSwitcher';
import { QuickCapture } from './components/QuickCapture';
import { ThoughtSpace } from './components/ThoughtSpace';
import { initialSpace } from './prototypeData';
import type { SpaceState } from './types';

// Three variants of the reflection experience, switchable via ?variant=, on one route.
function readVariant(): VariantKey {
  const value = new URLSearchParams(window.location.search).get('variant')?.toUpperCase();
  return value === 'B' || value === 'C' ? value : 'A';
}

type VariantProps = {
  state: SpaceState;
  onChange: (state: SpaceState) => void;
  onCapture: () => void;
};

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

export function VariantA({ state, onChange, onCapture }: VariantProps) {
  return (
    <main className="variant variant-a">
      <header className="a-header">
        <Wordmark />
        <button className="quiet-button" onClick={onCapture}>
          + Quick capture
        </button>
      </header>
      <ThoughtSpace state={state} onChange={onChange} />
      <div className="a-guidance">
        <span>Move a thought</span>
        <span className="guidance-dot" />
        <span>Touch and hold to join</span>
      </div>
      <StateReadout state={state} />
    </main>
  );
}

export function VariantB({ state, onChange, onCapture }: VariantProps) {
  const loose = state.thoughts.filter(
    (thought) =>
      !state.attachments.some(([a, b]) => a === thought.id || b === thought.id),
  );
  return (
    <main className="variant variant-b">
      <aside className="landing-rail">
        <Wordmark />
        <div className="landing-copy">
          <p className="eyebrow">Recently arrived</p>
          <h1>Nothing here is waiting to be finished.</h1>
          <p>{loose.length} loose thoughts are resting in your space.</p>
        </div>
        <div className="arrival-list">
          {loose.slice(0, 3).map((thought) => (
            <div className="arrival" key={thought.id}>
              {thought.text}
            </div>
          ))}
        </div>
        <button className="capture-button" onClick={onCapture}>
          Capture a thought <span>⌘ ↵</span>
        </button>
        <StateReadout state={state} />
      </aside>
      <section className="landing-canvas">
        <div className="canvas-label">
          <span>Reflection space</span>
          <span>Touch · hold · pull</span>
        </div>
        <ThoughtSpace state={state} onChange={onChange} mode="landing" />
      </section>
    </main>
  );
}

export function VariantC({ state, onChange, onCapture }: VariantProps) {
  const [focusedId, setFocusedId] = useState(
    state.thoughts[2]?.id ?? state.thoughts[0].id,
  );
  const focused =
    state.thoughts.find((thought) => thought.id === focusedId) ?? state.thoughts[0];
  const index = state.thoughts.findIndex((thought) => thought.id === focused.id);
  const moveFocus = (direction: -1 | 1) => {
    const next = (index + direction + state.thoughts.length) % state.thoughts.length;
    setFocusedId(state.thoughts[next].id);
  };

  return (
    <main className="variant variant-c">
      <header className="focus-header">
        <Wordmark />
        <button className="quiet-button" onClick={onCapture}>
          Capture
        </button>
      </header>
      <ThoughtSpace state={state} onChange={onChange} mode="focus" />
      <section className="focus-card" aria-label="Thought in focus">
        <p className="eyebrow">A thought to return to</p>
        <blockquote>{focused.text}</blockquote>
        <div className="focus-card__nav">
          <button onClick={() => moveFocus(-1)} aria-label="Previous thought">
            ←
          </button>
          <span>
            {index + 1} of {state.thoughts.length}
          </span>
          <button onClick={() => moveFocus(1)} aria-label="Next thought">
            →
          </button>
        </div>
        <p className="focus-hint">Move it when another thought comes to mind.</p>
      </section>
      <StateReadout state={state} />
    </main>
  );
}

export function App() {
  const [variant, setVariant] = useState<VariantKey>(readVariant);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [state, setState] = useState<SpaceState>(initialSpace);

  const changeVariant = (next: VariantKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', next);
    window.history.replaceState({}, '', url);
    setVariant(next);
  };

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
      {variant === 'A' && (
        <VariantA
          state={state}
          onChange={setState}
          onCapture={() => setCaptureOpen(true)}
        />
      )}
      {variant === 'B' && (
        <VariantB
          state={state}
          onChange={setState}
          onCapture={() => setCaptureOpen(true)}
        />
      )}
      {variant === 'C' && (
        <VariantC
          state={state}
          onChange={setState}
          onCapture={() => setCaptureOpen(true)}
        />
      )}
      <QuickCapture
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCapture={capture}
      />
      <PrototypeSwitcher current={variant} onChange={changeVariant} />
    </>
  );
}
