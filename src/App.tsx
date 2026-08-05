import { useCallback, useState } from 'react';

import {
  defaultAmbientBubbleSettings,
  type AmbientBubbleSettings,
} from './spatialFieldScene';
import {
  ambientBubblePresets,
  AmbientBubbleTuner,
} from './components/AmbientBubbleTuner';
import { SpatialThoughtComposer } from './components/SpatialThoughtComposer';
import { ThoughtSpace } from './components/ThoughtSpace';
import { spaceForQuery } from './initialSpace';
import {
  createSpatialInteraction,
  type SpatialInteractionInput,
} from './spatialInteraction';
import type { SpaceStorage } from './spaceStorage';
import { createThoughtAuthoring, type ThoughtAuthoringInput } from './thoughtAuthoring';
import { getThoughtTone } from './thoughtTone';

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
  const [authoring] = useState(createThoughtAuthoring);
  const [authoringState, setAuthoringState] = useState(authoring.read);
  const [ambientBubbleSettings, setAmbientBubbleSettings] =
    useState<AmbientBubbleSettings>(() => readAmbientBubbleSettings());
  const sendToField = useCallback(
    (input: SpatialInteractionInput) => {
      const transition = interaction.dispatch(input);
      setInteractionSnapshot(transition.snapshot);
      for (const effect of transition.effects) {
        switch (effect.type) {
          case 'request-create':
            authoring.dispatch({
              type: 'open-create',
              screenPosition: effect.screenPosition,
              worldPosition: effect.worldPosition,
              tone: effect.tone,
            });
            break;
          case 'request-edit':
            authoring.dispatch({
              type: 'open-edit',
              thought: effect.thought,
              screenPosition: effect.screenPosition,
            });
            break;
          case 'empty-activated':
            authoring.dispatch({ type: 'cancel' });
            break;
        }
      }
      setAuthoringState(authoring.read());
      return transition;
    },
    [authoring, interaction],
  );

  const sendToAuthoring = useCallback(
    (input: ThoughtAuthoringInput) => {
      const commands = authoring.dispatch(input);
      setAuthoringState(authoring.read());
      for (const command of commands) sendToField(command);
    },
    [authoring, sendToField],
  );

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
          findFreePosition={authoring.findFreePosition}
          ambientBubbleSettings={ambientBubbleSettings}
          composerOpen={authoringState.mode !== 'idle'}
          editingThoughtId={
            authoringState.mode === 'editing' ? authoringState.id : undefined
          }
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
      {authoringState.mode !== 'idle' && (
        <SpatialThoughtComposer
          key={authoringState.mode === 'editing' ? authoringState.id : 'new'}
          position={authoringState.screenPosition}
          initialText={
            authoringState.mode === 'editing' ? authoringState.initialText : undefined
          }
          label={authoringState.mode === 'editing' ? 'Edit thought' : undefined}
          toneColor={getThoughtTone(authoringState.tone).css}
          onCancel={() => sendToAuthoring({ type: 'cancel' })}
          onKeep={(text) => sendToAuthoring({ type: 'keep', text })}
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
