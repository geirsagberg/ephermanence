import { useCallback, useEffect, useState } from 'react';

import { QuickCapture } from './components/QuickCapture';
import {
  SpatialThoughtComposer,
  type DraftPosition,
} from './components/SpatialThoughtComposer';
import { ThoughtSpace } from './components/ThoughtSpace';
import { initialSpace } from './initialSpace';
import { createSpatialField, type SpatialFieldInput } from './spatialField';
import type { SpaceState } from './types';

const defaultQuickCapturePosition = { x: 280, y: 150 };

function Wordmark() {
  return (
    <div className="wordmark" aria-label="Ephermanence">
      <span className="wordmark__orb" />
      <span>ephermanence</span>
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
  const [field] = useState(() => createSpatialField(initialSpace));
  const [fieldSnapshot, setFieldSnapshot] = useState(field.read);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [draftPosition, setDraftPosition] = useState<DraftPosition | null>(null);
  const [draftWorldPosition, setDraftWorldPosition] = useState<DraftPosition | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const state = fieldSnapshot.state;

  const sendToField = useCallback(
    (input: SpatialFieldInput) => setFieldSnapshot(field.dispatch(input)),
    [field],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.key !== 'Enter' ||
        event.repeat ||
        (target instanceof HTMLElement &&
          target.matches('input, textarea, select, button, [contenteditable="true"]'))
      ) {
        return;
      }
      event.preventDefault();
      setQuickCaptureOpen(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const createThought = (text: string, position?: DraftPosition) => {
    sendToField({
      type: 'create-thought',
      id: `thought-${Date.now()}`,
      text,
      position: position ?? defaultQuickCapturePosition,
    });
    setDraftPosition(null);
    setDraftWorldPosition(null);
    setEditingId(null);
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
          selectedId={fieldSnapshot.selectedId}
          onInput={sendToField}
          onCreateRequest={(screenPosition, worldPosition) => {
            setDraftPosition(screenPosition);
            setDraftWorldPosition(worldPosition);
            setEditingId(null);
          }}
          onEditRequest={(thought, position) => {
            setDraftPosition(position);
            setDraftWorldPosition(null);
            setEditingId(thought.id);
          }}
          onEmptyClick={() => {
            setDraftPosition(null);
            setDraftWorldPosition(null);
            setEditingId(null);
          }}
        />
        <div className="app-guidance">
          <span>Double-click empty space to add</span>
          <span className="guidance-dot" />
          <span>Drag empty space to pan</span>
          <span className="guidance-dot" />
          <span>Scroll to zoom</span>
          <span className="guidance-dot" />
          <span>+ − 0 zoom</span>
          <span className="guidance-dot" />
          <span>Shift-drag to move one</span>
          <span className="guidance-dot" />
          <span>Enter quick capture</span>
        </div>
        <StateReadout state={state} />
      </main>
      {draftPosition && (
        <SpatialThoughtComposer
          key={editingId ?? 'new'}
          position={draftPosition}
          initialText={
            editingId
              ? state.thoughts.find((thought) => thought.id === editingId)?.text
              : undefined
          }
          label={editingId ? 'Edit thought' : undefined}
          onCancel={() => {
            setDraftPosition(null);
            setDraftWorldPosition(null);
            setEditingId(null);
          }}
          onCreate={(text) => {
            if (!editingId) {
              createThought(text, draftWorldPosition ?? draftPosition);
              return;
            }
            sendToField({ type: 'edit-thought', id: editingId, text });
            setDraftPosition(null);
            setDraftWorldPosition(null);
            setEditingId(null);
          }}
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
