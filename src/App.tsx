import { useCallback, useState } from 'react';

import {
  SpatialThoughtComposer,
  type DraftPosition,
} from './components/SpatialThoughtComposer';
import { ThoughtSpace } from './components/ThoughtSpace';
import { initialSpace } from './initialSpace';
import { createSpatialField, type SpatialFieldInput } from './spatialField';

function Wordmark() {
  return (
    <div className="wordmark" aria-label="Ephermanence">
      <span className="wordmark__orb" />
      <span>ephermanence</span>
    </div>
  );
}

export function App() {
  const [field] = useState(() => createSpatialField(initialSpace));
  const [fieldSnapshot, setFieldSnapshot] = useState(field.read);
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

  const createThought = (text: string, position: DraftPosition) => {
    sendToField({
      type: 'create-thought',
      id: `thought-${Date.now()}`,
      text,
      position,
    });
    setDraftPosition(null);
    setDraftWorldPosition(null);
    setEditingId(null);
  };

  return (
    <>
      <main className="app-shell">
        <header className="app-header">
          <Wordmark />
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
          <span>Shift-drag to detach</span>
          <span className="guidance-dot" />
          <span>Enter to add at pointer</span>
        </div>
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
    </>
  );
}
