import { useCallback, useState } from 'react';

import {
  defaultAmbientBubbleSettings,
  type AmbientBubbleSettings,
} from './ambientBubbleField';
import {
  ambientBubblePresets,
  AmbientBubbleTuner,
} from './components/AmbientBubbleTuner';
import {
  SpatialThoughtComposer,
  type DraftPosition,
} from './components/SpatialThoughtComposer';
import { ThoughtSpace } from './components/ThoughtSpace';
import { spaceForQuery } from './initialSpace';
import {
  createSpatialInteraction,
  type SpatialInteractionEffect,
  type SpatialInteractionInput,
} from './spatialInteraction';
import type { SpaceStorage } from './spaceStorage';

function Wordmark() {
  return (
    <div className="wordmark" aria-label="Ephermanence">
      <span className="wordmark__orb" />
      <span>ephermanence</span>
    </div>
  );
}

export function App() {
  const tuningAmbientBubbles = new URLSearchParams(window.location.search).has('tune');
  const [storage] = useState<SpaceStorage | null>(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has('debug')) return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  });
  const [interaction] = useState(() => {
    return createSpatialInteraction(spaceForQuery(window.location.search), storage);
  });
  const [interactionSnapshot, setInteractionSnapshot] = useState(interaction.read);
  const [draftPosition, setDraftPosition] = useState<DraftPosition | null>(null);
  const [draftWorldPosition, setDraftWorldPosition] = useState<DraftPosition | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ambientBubbleSettings, setAmbientBubbleSettings] =
    useState<AmbientBubbleSettings>(() => readAmbientBubbleSettings());
  const state = interactionSnapshot.state;

  const sendToField = useCallback(
    (input: SpatialInteractionInput) => {
      const transition = interaction.dispatch(input);
      setInteractionSnapshot(transition.snapshot);
      applyEffects(transition.effects, {
        openCreate(screenPosition, worldPosition) {
          setDraftPosition(screenPosition);
          setDraftWorldPosition(worldPosition);
          setEditingId(null);
        },
        openEdit(thought, position) {
          setDraftPosition(position);
          setDraftWorldPosition(null);
          setEditingId(thought.id);
        },
        closeComposer() {
          setDraftPosition(null);
          setDraftWorldPosition(null);
          setEditingId(null);
        },
      });
      return transition;
    },
    [interaction],
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
          interaction={interaction}
          snapshot={interactionSnapshot}
          onInput={sendToField}
          ambientBubbleSettings={ambientBubbleSettings}
          composerOpen={draftPosition !== null}
        />
      </main>
      {tuningAmbientBubbles && (
        <AmbientBubbleTuner
          settings={ambientBubbleSettings}
          onChange={(settings, preset) => {
            setAmbientBubbleSettings(settings);
            writeAmbientBubbleSettings(settings, preset);
          }}
        />
      )}
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

function readAmbientBubbleSettings(): AmbientBubbleSettings {
  const query = new URLSearchParams(window.location.search);
  if (!query.has('tune')) return defaultAmbientBubbleSettings;
  const preset = query.get('variant');
  if (preset && preset in ambientBubblePresets) {
    return ambientBubblePresets[preset as keyof typeof ambientBubblePresets];
  }
  return {
    size: readNumber(query, 'size', ambientBubblePresets.haze.size),
    presence: readNumber(query, 'presence', ambientBubblePresets.haze.presence),
    density: readNumber(query, 'density', ambientBubblePresets.haze.density),
  };
}

function writeAmbientBubbleSettings(
  settings: AmbientBubbleSettings,
  preset?: keyof typeof ambientBubblePresets,
) {
  const url = new URL(window.location.href);
  if (preset) url.searchParams.set('variant', preset);
  else url.searchParams.delete('variant');
  url.searchParams.set('size', String(settings.size));
  url.searchParams.set('presence', String(settings.presence));
  url.searchParams.set('density', String(settings.density));
  window.history.replaceState(null, '', url);
}

function readNumber(query: URLSearchParams, key: string, fallback: number) {
  const value = Number(query.get(key));
  return Number.isFinite(value) && query.has(key) ? value : fallback;
}

type EffectHandlers = {
  openCreate: (screenPosition: DraftPosition, worldPosition: DraftPosition) => void;
  openEdit: (thought: { id: string }, position: DraftPosition) => void;
  closeComposer: () => void;
};

function applyEffects(effects: SpatialInteractionEffect[], handlers: EffectHandlers) {
  for (const effect of effects) {
    switch (effect.type) {
      case 'request-create':
        handlers.openCreate(effect.screenPosition, effect.worldPosition);
        break;
      case 'request-edit':
        handlers.openEdit(effect.thought, effect.screenPosition);
        break;
      case 'empty-activated':
        handlers.closeComposer();
        break;
    }
  }
}
