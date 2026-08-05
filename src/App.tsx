import { useCallback, useState } from 'react';

import {
  SpatialThoughtComposer,
  type DraftPosition,
} from './components/SpatialThoughtComposer';
import { ThoughtSpace } from './components/ThoughtSpace';
import {
  PrototypeSwitcher,
  type LauncherVariant,
} from './components/ThoughtLauncherPrototype';
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
  // PROTOTYPE: Three mobile composer variants, switchable via ?variant=, on the existing space.
  const [launcherVariant, setLauncherVariant] = useState<LauncherVariant>(() => {
    const requested = new URLSearchParams(window.location.search).get('variant');
    return requested === 'B' || requested === 'C' ? requested : 'A';
  });
  const [storage] = useState<SpaceStorage | null>(() => {
    // Prototype sessions are intentionally disposable.
    return null;
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
          showHint={false}
          onInput={sendToField}
          launcherVariant={launcherVariant}
          composerOpen={draftPosition !== null}
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
          prototypeVariant={editingId ? undefined : launcherVariant}
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
      <PrototypeSwitcher
        current={launcherVariant}
        composerOpen={draftPosition !== null}
        onChange={(variant) => {
          setLauncherVariant(variant);
          setDraftPosition(null);
          setDraftWorldPosition(null);
          setEditingId(null);
        }}
      />
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
