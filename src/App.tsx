import { Provider, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Download, Moon, Upload } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { ZoomControls } from './components/ZoomControls';
import { spaceForQuery } from './initialSpace';
import { createSpatialInteraction } from './spatialInteraction';
import {
  createSpatialFieldInputAdapter,
  type SpatialFieldInputAdapter,
} from './spatialFieldInputAdapter';
import type { SpaceStorage } from './spaceStorage';
import { parseSpaceImport, serializeSpaceExport } from './spaceTransfer';
import { createThoughtAuthoring, type ThoughtAuthoringState } from './thoughtAuthoring';
import { hasThoughtAttachment } from './thoughtActions';
import { thoughtRadius } from './thoughtTextLayout';
import { composerScaleForThought } from './thoughtTransition';
import type { SpaceState } from './types';

type ColorMode = 'light' | 'dark';

function WordmarkMenu({
  colorMode,
  onColorModeChange,
  onExport,
  onImport,
}: {
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  onExport: () => void;
  onImport: (space: SpaceState) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismissOnPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', dismissOnPointerDown);
    window.addEventListener('keydown', dismissOnEscape);
    return () => {
      window.removeEventListener('pointerdown', dismissOnPointerDown);
      window.removeEventListener('keydown', dismissOnEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className={wordmarkMenuClass} data-open={open || undefined}>
      <button
        type="button"
        className={wordmarkTriggerClass}
        aria-label="Ephermanence menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={wordmarkOrbClass} />
        <span>ephermanence</span>
      </button>
      <div className={wordmarkItemsClass} role="menu" aria-hidden={!open}>
        <button
          type="button"
          className={themeChoiceClass}
          role="menuitemcheckbox"
          aria-checked={colorMode === 'dark'}
          tabIndex={open ? 0 : -1}
          onClick={() => onColorModeChange(colorMode === 'dark' ? 'light' : 'dark')}
        >
          <Moon size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Dark mode</span>
          <span className={themeSwitchClass} aria-hidden="true">
            <span />
          </span>
        </button>
        <button
          type="button"
          className={menuActionClass}
          role="menuitem"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            onExport();
            setOpen(false);
          }}
        >
          <Download size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Export</span>
        </button>
        <button
          type="button"
          className={menuActionClass}
          role="menuitem"
          tabIndex={open ? 0 : -1}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>Import</span>
        </button>
      </div>
      <input
        ref={fileInputRef}
        className={fileInputClass}
        type="file"
        accept=".json,application/json"
        tabIndex={-1}
        onChange={async (event) => {
          const input = event.currentTarget;
          const file = input.files?.[0];
          if (!file) return;
          try {
            const imported = parseSpaceImport(await file.text());
            if (!imported) {
              window.alert('That file is not a valid Ephermanence export.');
              return;
            }
            if (onImport(imported)) setOpen(false);
          } catch {
            window.alert('That file could not be read.');
          } finally {
            input.value = '';
          }
        }}
      />
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
  const [colorMode, setColorMode] = useState<ColorMode>(readColorMode);
  const [authoringOffsetY, setAuthoringOffsetY] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = colorMode;
    document.documentElement.style.colorScheme = colorMode;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', colorMode === 'dark' ? '#171b19' : '#ebe8df');
    try {
      window.localStorage.setItem(colorModeStorageKey, colorMode);
    } catch {
      // Theme persistence is optional when storage is unavailable.
    }
  }, [colorMode]);

  return (
    <>
      <div
        className={authoringViewportClass}
        style={{ '--authoring-offset-y': `${authoringOffsetY}px` } as CSSProperties}
      >
        <main className={appShellClass}>
          <header className={appHeaderClass}>
            <WordmarkMenu
              colorMode={colorMode}
              onColorModeChange={setColorMode}
              onExport={() => downloadSpace(runtime.interaction.read().state)}
              onImport={(space) => {
                if (
                  runtime.interaction.read().state.thoughts.length > 0 &&
                  !window.confirm('Replace the current space with this import?')
                ) {
                  return false;
                }
                runtime.fieldInput.send({ type: 'replace-space', state: space });
                return true;
              }}
            />
            <ZoomControls inputAdapter={runtime.fieldInput} />
          </header>
          <ThoughtSpace
            interaction={runtime.interaction}
            inputAdapter={runtime.fieldInput}
            findFreePosition={runtime.authoring.findFreePosition}
            colorMode={colorMode}
          />
        </main>
        <ConnectedSpatialThoughtComposer
          runtime={runtime}
          onViewportOffsetChange={setAuthoringOffsetY}
        />
      </div>
      {tuningAmbientBubbles && <ConnectedAmbientBubbleTuner />}
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

function ConnectedSpatialThoughtComposer({
  runtime,
  onViewportOffsetChange,
}: {
  runtime: AppRuntime;
  onViewportOffsetChange: (offsetY: number) => void;
}) {
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
      onViewportOffsetChange={onViewportOffsetChange}
      onCancel={() => sendToAuthoring({ type: 'cancel' })}
      onExitComplete={() => setRetainedState(null)}
      onKeep={(text) => sendToAuthoring({ type: 'keep', text })}
    />
  ) : null;
}

const authoringViewportClass = css({
  position: 'fixed',
  inset: 0,
  transform: 'translateY(var(--authoring-offset-y))',
});

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
  color: '#27302c',
  _after: {
    position: 'absolute',
    zIndex: 0,
    inset: 0,
    background:
      'radial-gradient(circle at 48% 43%, rgb(63 72 68 / 24%), transparent 44%), linear-gradient(135deg, #121614, #1d2220 55%, #141a17)',
    content: '""',
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 480ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  '[data-theme=dark] &': {
    color: '#e7ebe7',
    _after: {
      opacity: 1,
    },
  },
});

const appHeaderClass = css({
  position: 'absolute',
  zIndex: 20,
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

const wordmarkMenuClass = css({
  width: '156px',
  overflow: 'hidden',
  border: '1px solid rgb(39 48 44 / 16%)',
  borderRadius: '19.5px',
  background: 'rgb(247 246 241 / 76%)',
  boxShadow: '0 5px 20px rgb(39 48 44 / 7%)',
  backdropFilter: 'blur(16px) saturate(115%)',
  transition:
    'border-color 480ms ease, background-color 480ms ease, box-shadow 480ms ease',
  '&[data-open]': {
    boxShadow: '0 12px 34px rgb(39 48 44 / 12%)',
  },
  '[data-theme=dark] &': {
    borderColor: 'rgb(236 242 238 / 14%)',
    background: 'rgb(30 36 33 / 78%)',
    boxShadow: '0 8px 26px rgb(0 0 0 / 18%)',
  },
});

const wordmarkTriggerClass = css({
  display: 'flex',
  width: '100%',
  height: '37px',
  gap: '10px',
  alignItems: 'center',
  padding: '0 10px',
  border: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 500,
  letterSpacing: '-0.01em',
  textAlign: 'left',
  WebkitTapHighlightColor: 'transparent',
});

const wordmarkOrbClass = css({
  width: '17px',
  height: '17px',
  border: '1px solid rgb(39 48 44 / 55%)',
  borderRadius: '50%',
  boxShadow: 'inset 4px 4px 8px rgb(255 255 255 / 45%)',
  transition: 'border-color 480ms ease, box-shadow 480ms ease',
  '[data-theme=dark] &': {
    borderColor: 'rgb(231 235 231 / 58%)',
    boxShadow: 'inset 4px 4px 8px rgb(255 255 255 / 10%)',
  },
});

const wordmarkItemsClass = css({
  height: 0,
  opacity: 0,
  visibility: 'hidden',
  transition:
    'height 240ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 160ms ease, visibility 0s linear 240ms',
  '[data-open] &': {
    height: '111px',
    opacity: 1,
    visibility: 'visible',
    transitionDelay: '0ms',
  },
});

const themeChoiceClass = css({
  display: 'grid',
  height: '35px',
  width: 'calc(100% - 12px)',
  gridTemplateColumns: '16px 1fr auto',
  gap: '7px',
  alignItems: 'center',
  margin: '0 6px',
  padding: '9px 8px',
  overflow: 'hidden',
  border: 0,
  borderTop: '1px solid rgb(39 48 44 / 10%)',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '13px',
  textAlign: 'left',
  '[data-theme=dark] &': {
    borderTopColor: 'rgb(236 242 238 / 10%)',
  },
});

const menuActionClass = css({
  display: 'grid',
  height: '35px',
  width: 'calc(100% - 12px)',
  gridTemplateColumns: '16px 1fr',
  gap: '7px',
  alignItems: 'center',
  margin: '0 6px',
  padding: '9px 8px',
  overflow: 'hidden',
  border: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '13px',
  textAlign: 'left',
  _hover: {
    background: 'rgb(39 48 44 / 6%)',
  },
  '[data-theme=dark] &': {
    _hover: {
      background: 'rgb(236 242 238 / 7%)',
    },
  },
  '&:last-child': {
    marginBottom: '6px',
  },
});

const fileInputClass = css({
  display: 'none',
});

const themeSwitchClass = css({
  position: 'relative',
  width: '30px',
  height: '18px',
  border: '1px solid rgb(39 48 44 / 22%)',
  borderRadius: '999px',
  background: 'rgb(39 48 44 / 8%)',
  transition: 'border-color 300ms ease, background-color 300ms ease',
  '& > span': {
    position: 'absolute',
    top: '3px',
    left: '3px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#57615c',
    transition:
      'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 300ms ease',
  },
  '[aria-checked=true] &': {
    borderColor: 'rgb(180 201 189 / 46%)',
    background: 'rgb(125 157 140 / 42%)',
    '& > span': {
      background: '#edf2ee',
      transform: 'translateX(12px)',
    },
  },
});

const colorModeStorageKey = 'ephermanence-color-mode';

function readColorMode(): ColorMode {
  try {
    return window.localStorage.getItem(colorModeStorageKey) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function downloadSpace(space: SpaceState) {
  const blob = new Blob([serializeSpaceExport(space)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ephermanence-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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
