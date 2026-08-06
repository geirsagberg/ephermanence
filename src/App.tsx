import { Provider, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import { css } from '../styled-system/css';

import {
  ambientBubbleSettingsAtom,
  createAppState,
  sendThoughtAuthoringAtom,
  thoughtAuthoringStateAtom,
} from './appState';
import {
  defaultAmbientBubbleSettings,
  type AmbientBubbleSettings,
  type ThoughtAuthoringPresentation,
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
  type SpatialFieldInputAdapter,
} from './spatialFieldInputAdapter';
import type { SpaceStorage } from './spaceStorage';
import { createThoughtAuthoring, type ThoughtAuthoringState } from './thoughtAuthoring';
import { hasThoughtAttachment } from './thoughtActions';
import { thoughtRadius } from './thoughtTextLayout';
import { composerScaleForThought } from './thoughtTransition';

function Wordmark() {
  return (
    <div className={wordmarkClass} aria-label="Ephermanence">
      <span className={wordmarkOrbClass} />
      <span>ephermanence</span>
    </div>
  );
}

export function App() {
  const [runtime] = useState(createAppRuntime);
  return (
    <Provider store={runtime.state.store}>
      <AppView runtime={runtime} />
    </Provider>
  );
}

type AppRuntime = ReturnType<typeof createAppRuntime>;

function AppView({ runtime }: { runtime: AppRuntime }) {
  const tuningAmbientBubbles = new URLSearchParams(window.location.search).has('tune');

  return (
    <>
      <main className={appShellClass}>
        <header className={appHeaderClass}>
          <Wordmark />
        </header>
        <ThoughtSpace
          interaction={runtime.interaction}
          inputAdapter={runtime.fieldInput}
          findFreePosition={runtime.authoring.findFreePosition}
        />
      </main>
      {tuningAmbientBubbles && <ConnectedAmbientBubbleTuner />}
      <ConnectedSpatialThoughtComposer runtime={runtime} />
    </>
  );
}

function ConnectedAmbientBubbleTuner() {
  const [settings, setSettings] = useAtom(ambientBubbleSettingsAtom);
  return (
    <AmbientBubbleTuner
      settings={settings}
      onChange={(nextSettings, preset) => {
        setSettings(nextSettings);
        writeAmbientBubbleSettings(nextSettings, preset);
      }}
    />
  );
}

function ConnectedSpatialThoughtComposer({ runtime }: { runtime: AppRuntime }) {
  const authoringState = useAtomValue(thoughtAuthoringStateAtom);
  const sendToAuthoring = useSetAtom(sendThoughtAuthoringAtom);
  const activeState = authoringState.mode === 'idle' ? null : authoringState;
  const [retainedState, setRetainedState] = useState<Exclude<
    ThoughtAuthoringState,
    { mode: 'idle' }
  > | null>(activeState);
  useEffect(() => {
    if (activeState) setRetainedState(activeState);
  }, [activeState]);
  const displayedState = activeState ?? retainedState;
  const interactionSnapshot = runtime.interaction.read();
  const zoom = interactionSnapshot.camera.zoom;
  const editingThought =
    displayedState?.mode === 'editing'
      ? interactionSnapshot.state.thoughts.find(({ id }) => id === displayedState.id)
      : undefined;
  const editingRadius =
    displayedState?.mode === 'editing'
      ? thoughtRadius(editingThought?.text ?? '')
      : undefined;
  const editingElevation =
    editingThought &&
    !hasThoughtAttachment(editingThought.id, interactionSnapshot.state.attachments)
      ? 1
      : 0;
  const presentAuthoring = useCallback(
    (presentation?: ThoughtAuthoringPresentation) =>
      runtime.fieldInput.send({ type: 'present-authoring', presentation }),
    [runtime.fieldInput],
  );
  return displayedState ? (
    <SpatialThoughtComposer
      key={displayedState.mode === 'editing' ? displayedState.id : 'new'}
      visualId={displayedState.mode === 'editing' ? displayedState.id : 'new'}
      dismissOnCancel={displayedState.mode === 'creating'}
      cancelTargetScale={
        editingRadius === undefined
          ? undefined
          : composerScaleForThought(editingRadius, zoom)
      }
      openScale={
        editingRadius === undefined
          ? undefined
          : composerScaleForThought(editingRadius, zoom)
      }
      targetScaleForText={(text) => composerScaleForThought(thoughtRadius(text), zoom)}
      position={displayedState.screenPosition}
      initialText={
        displayedState.mode === 'editing' ? displayedState.initialText : undefined
      }
      label={displayedState.mode === 'editing' ? 'Edit thought' : undefined}
      tone={displayedState.tone}
      elevation={{
        source: displayedState.mode === 'editing' ? editingElevation : 0,
        target: displayedState.mode === 'editing' ? editingElevation : 1,
        zoom,
      }}
      onVisualChange={presentAuthoring}
      onCancel={() => sendToAuthoring({ type: 'cancel' })}
      onExitComplete={() => setRetainedState(null)}
      onKeep={(text) => sendToAuthoring({ type: 'keep', text })}
    />
  ) : null;
}

function createAppRuntime() {
  const search = window.location.search;
  const storage = readStorage(search);
  const interaction = createSpatialInteraction(spaceForQuery(search), storage);
  const authoring = createThoughtAuthoring();
  let fieldInput: SpatialFieldInputAdapter;
  const state = createAppState({
    initialSnapshot: interaction.read(),
    initialAmbientBubbleSettings: readAmbientBubbleSettings(),
    authoring,
    sendToField: (input) => fieldInput.send(input),
  });
  fieldInput = createSpatialFieldInputAdapter({
    interaction,
    onFrame: (frame) => state.acceptFieldFrame(frame),
    onFailure: (error) => console.error('Spatial field failed to start', error),
  });
  return { state, interaction, authoring, fieldInput };
}

function readStorage(search: string): SpaceStorage | null {
  if (new URLSearchParams(search).has('debug')) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
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
