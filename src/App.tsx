import { useCallback, useRef, useState } from 'react';
import { css } from '../styled-system/css';

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
import { createSpatialInteraction } from './spatialInteraction';
import {
  createSpatialFieldInputAdapter,
  type SpatialFieldFrame,
} from './spatialFieldInputAdapter';
import type { SpaceStorage } from './spaceStorage';
import { createThoughtAuthoring, type ThoughtAuthoringInput } from './thoughtAuthoring';
import { getThoughtTone } from './thoughtTone';

function Wordmark() {
  return (
    <div className={wordmarkClass} aria-label="Ephermanence">
      <span className={wordmarkOrbClass} />
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
  const [authoring] = useState(createThoughtAuthoring);
  const [interactionSnapshot, setInteractionSnapshot] = useState(interaction.read);
  const [authoringState, setAuthoringState] = useState(authoring.read);
  const [launchRequest, setLaunchRequest] = useState(0);
  const [ambientBubbleSettings, setAmbientBubbleSettings] =
    useState<AmbientBubbleSettings>(() => readAmbientBubbleSettings());
  const onFieldFrameRef = useRef<(frame: SpatialFieldFrame) => void>(() => {});
  const [fieldInput] = useState(() =>
    createSpatialFieldInputAdapter({
      interaction,
      onFrame: (frame) => onFieldFrameRef.current(frame),
      onFailure: (error) => console.error('Spatial field failed to start', error),
    }),
  );
  onFieldFrameRef.current = (frame) => {
    setInteractionSnapshot(frame.snapshot);
    if (frame.launchRequests > 0) {
      setLaunchRequest((request) => request + frame.launchRequests);
    }
    for (const effect of frame.effects) {
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
  };

  const sendToAuthoring = useCallback(
    (input: ThoughtAuthoringInput) => {
      const commands = authoring.dispatch(input);
      setAuthoringState(authoring.read());
      for (const command of commands) {
        fieldInput.send({ type: 'authoring-command', command });
      }
    },
    [authoring, fieldInput],
  );

  return (
    <>
      <main className={appShellClass}>
        <header className={appHeaderClass}>
          <Wordmark />
        </header>
        <ThoughtSpace
          interaction={interaction}
          inputAdapter={fieldInput}
          snapshot={interactionSnapshot}
          findFreePosition={authoring.findFreePosition}
          launchRequest={launchRequest}
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

const appShellClass = css({
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  background:
    'radial-gradient(circle at 48% 43%, rgb(255 255 255 / 65%), transparent 42%), linear-gradient(135deg, #e8e7df, #f2efe7 55%, #e4e8e2)',
});

const appHeaderClass = css({
  position: 'absolute',
  zIndex: 3,
  top: 0,
  right: 0,
  left: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '24px 30px',
  pointerEvents: 'none',
  '& > *': {
    pointerEvents: 'auto',
  },
  '@media (max-width: 720px)': {
    padding: '18px',
  },
});

const wordmarkClass = css({
  display: 'flex',
  gap: '10px',
  alignItems: 'center',
  fontSize: '14px',
  fontWeight: 500,
  letterSpacing: '-0.01em',
});

const wordmarkOrbClass = css({
  width: '17px',
  height: '17px',
  border: '1px solid rgb(39 48 44 / 55%)',
  borderRadius: '50%',
  boxShadow: 'inset 4px 4px 8px rgb(255 255 255 / 45%)',
});

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
