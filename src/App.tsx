import { useCallback, useState } from 'react';

import {
  SpatialThoughtComposer,
  type DraftPosition,
} from './components/SpatialThoughtComposer';
import { ThoughtSpace } from './components/ThoughtSpace';
import { spaceForQuery } from './initialSpace';
import { createSpatialField, type SpatialFieldInput } from './spatialField';
import { loadStoredSpace, saveStoredSpace, type SpaceStorage } from './spaceStorage';

function Wordmark() {
  return (
    <div className="wordmark" aria-label="Ephermanence">
      <span className="wordmark__orb" />
      <span>ephermanence</span>
    </div>
  );
}

export function App() {
  const [storage] = useState<SpaceStorage | null>(() => {
    if (new URLSearchParams(window.location.search).has('debug')) return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  });
  const [field] = useState(() => {
    const initialState =
      loadStoredSpace(storage) ?? spaceForQuery(window.location.search);
    return createSpatialField(initialState);
  });
  const [fieldSnapshot, setFieldSnapshot] = useState(field.read);
  const [draftPosition, setDraftPosition] = useState<DraftPosition | null>(null);
  const [draftWorldPosition, setDraftWorldPosition] = useState<DraftPosition | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const state = fieldSnapshot.state;

  const sendToField = useCallback(
    (input: SpatialFieldInput) => {
      const next = field.dispatch(input);
      setFieldSnapshot(next);
      if (shouldPersist(input)) saveStoredSpace(storage, next.state);
    },
    [field, storage],
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
          attachmentCandidateIds={fieldSnapshot.attachmentCandidateIds}
          isDragging={fieldSnapshot.isDragging}
          showHint={draftPosition === null}
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

function shouldPersist(input: SpatialFieldInput) {
  return (
    input.type === 'pointer-up' ||
    input.type === 'delete-selection' ||
    input.type === 'edit-thought' ||
    input.type === 'create-thought'
  );
}
