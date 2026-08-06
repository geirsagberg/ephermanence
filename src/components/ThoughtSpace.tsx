import { Grip, Pencil, X } from 'lucide-react';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { Fragment, useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { css, cx } from '../../styled-system/css';

import {
  ambientBubbleSettingsAtom,
  composerOpenAtom,
  editingThoughtIdAtom,
  fieldSnapshotAtom,
} from '../appState';
import type { SpatialInteraction } from '../spatialInteraction';
import type {
  SpatialFieldInputAdapter,
  ThoughtControl,
  ThoughtControlEvent,
} from '../spatialFieldInputAdapter';
import type { ThoughtAuthoring } from '../thoughtAuthoring';
import {
  hasThoughtAttachment,
  positionThoughtActions,
  THOUGHT_ACTION_SIZE,
} from '../thoughtActions';
import { thoughtRadius } from '../thoughtTextLayout';
import { shouldPreserveNativeLongPressHaptics } from '../touchThoughtAuthoring';
import { ThoughtLauncher } from './ThoughtLauncher';

type ThoughtSpaceProps = {
  interaction: SpatialInteraction;
  inputAdapter: SpatialFieldInputAdapter;
  findFreePosition: ThoughtAuthoring['findFreePosition'];
  colorMode: 'light' | 'dark';
  className?: string;
};

export function ThoughtSpace({
  interaction,
  inputAdapter,
  findFreePosition,
  colorMode,
  className = '',
}: ThoughtSpaceProps) {
  const snapshot = useAtomValue(fieldSnapshotAtom);
  const editingThoughtId = useAtomValue(editingThoughtIdAtom);
  const composerOpen = useAtomValue(composerOpenAtom);
  const ambientBubbleSettings = useAtomValue(ambientBubbleSettingsAtom);
  const hostRef = useRef<HTMLDivElement>(null);
  const getNewThoughtPosition = () => {
    const current = interaction.read();
    const currentZoom = current.camera.zoom;
    return findFreePosition({
      thoughts: current.state.thoughts.map((thought) => ({
        ...interaction.worldToScreen(thought),
        radius: thoughtRadius(thought.text) * currentZoom,
      })),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      zoom: currentZoom,
    });
  };
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    return inputAdapter.mount(host);
  }, [inputAdapter]);

  useEffect(() => {
    inputAdapter.send({
      type: 'present',
      presentation: {
        ambientBubbleSettings,
        hiddenThoughtId: editingThoughtId,
        colorMode,
      },
    });
  }, [inputAdapter, ambientBubbleSettings, colorMode, editingThoughtId]);

  const selectedThought = snapshot.state.thoughts.find(
    (thought) => thought.id === snapshot.selectedId,
  );
  const host = hostRef.current;
  const selectedPosition =
    selectedThought && host ? interaction.worldToScreen(selectedThought) : null;
  const zoom = snapshot.camera.zoom;
  const actionPositions =
    selectedThought && selectedPosition
      ? positionThoughtActions(
          selectedPosition,
          thoughtRadius(selectedThought.text) * zoom,
        )
      : null;
  const selectedThoughtHasBond =
    selectedThought &&
    hasThoughtAttachment(selectedThought.id, snapshot.state.attachments);
  const sendControl = (
    control: ThoughtControl,
    thoughtId: string,
    event: ThoughtControlEvent,
  ) => inputAdapter.send({ type: 'thought-control', control, thoughtId, event });

  return (
    <div
      ref={hostRef}
      className={cx(thoughtSpaceClass, className)}
      data-authoring={composerOpen || undefined}
      data-native-long-press-haptics={
        shouldPreserveNativeLongPressHaptics(navigator) || undefined
      }
    >
      {!composerOpen && selectedThought && selectedPosition && actionPositions && (
        <Fragment key={selectedThought.id}>
          <button
            title="Edit thought"
            className={cx(actionButtonClass, directActionButtonClass)}
            style={actionStyle(selectedPosition, actionPositions.edit)}
            onPointerDown={(event) =>
              sendControl(
                'edit',
                selectedThought.id,
                pointerControlEvent('pointer-down', event),
              )
            }
            onPointerUp={(event) =>
              sendControl(
                'edit',
                selectedThought.id,
                pointerControlEvent('pointer-up', event),
              )
            }
            onPointerCancel={(event) =>
              sendControl(
                'edit',
                selectedThought.id,
                pointerControlEvent('pointer-cancel', event),
              )
            }
            onClick={(event) =>
              sendControl('edit', selectedThought.id, keyboardControlEvent(event))
            }
            aria-label={`Edit thought: ${selectedThought.text}`}
          >
            <Pencil size={20} strokeWidth={1} aria-hidden="true" />
          </button>
          <button
            title="Delete thought"
            className={cx(actionButtonClass, directActionButtonClass)}
            style={actionStyle(selectedPosition, actionPositions.delete)}
            onPointerDown={(event) =>
              sendControl(
                'delete',
                selectedThought.id,
                pointerControlEvent('pointer-down', event),
              )
            }
            onPointerUp={(event) =>
              sendControl(
                'delete',
                selectedThought.id,
                pointerControlEvent('pointer-up', event),
              )
            }
            onPointerCancel={(event) =>
              sendControl(
                'delete',
                selectedThought.id,
                pointerControlEvent('pointer-cancel', event),
              )
            }
            onClick={(event) =>
              sendControl('delete', selectedThought.id, keyboardControlEvent(event))
            }
            aria-label={`Delete thought: ${selectedThought.text}`}
          >
            <X size={20} strokeWidth={1} aria-hidden="true" />
          </button>
          {selectedThoughtHasBond && (
            <button
              title="Move thought independently"
              className={cx(actionButtonClass, grabActionButtonClass)}
              style={actionStyle(selectedPosition, actionPositions.grab)}
              onPointerDown={(event) =>
                sendControl(
                  'grab',
                  selectedThought.id,
                  pointerControlEvent('pointer-down', event),
                )
              }
              onPointerUp={(event) =>
                sendControl(
                  'grab',
                  selectedThought.id,
                  pointerControlEvent('pointer-up', event),
                )
              }
              onPointerCancel={(event) =>
                sendControl(
                  'grab',
                  selectedThought.id,
                  pointerControlEvent('pointer-cancel', event),
                )
              }
              aria-label={`Move thought independently: ${selectedThought.text}`}
            >
              <Grip size={20} strokeWidth={1} aria-hidden="true" />
            </button>
          )}
        </Fragment>
      )}
      <ThoughtLauncher
        getTapPosition={getNewThoughtPosition}
        onOpen={(screenPosition) => {
          inputAdapter.send({
            type: 'launcher-open',
            point: screenPosition,
          });
        }}
      />
    </div>
  );
}

function pointerControlEvent(
  phase: 'pointer-down' | 'pointer-up' | 'pointer-cancel',
  event: ReactPointerEvent<HTMLButtonElement>,
): ThoughtControlEvent {
  return {
    phase,
    pointerId: event.pointerId,
    pointerKind: event.pointerType,
    clientPoint: { x: event.clientX, y: event.clientY },
    timeStamp: event.timeStamp,
    consume: () => {
      event.preventDefault();
      event.stopPropagation();
    },
    capturePointer: () => event.currentTarget.setPointerCapture(event.pointerId),
  };
}

function keyboardControlEvent(
  event: ReactMouseEvent<HTMLButtonElement>,
): ThoughtControlEvent {
  return {
    phase: 'keyboard-activate',
    timeStamp: event.timeStamp,
    clickDetail: event.detail,
    consume: () => {
      if (event.detail === 0) event.preventDefault();
      event.stopPropagation();
    },
  };
}

const thoughtSpaceClass = css({
  position: 'absolute',
  zIndex: 1,
  inset: 0,
  touchAction: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  '& canvas': {
    display: 'block',
    width: '100%',
    height: '100%',
    cursor: 'grab',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
  '&[data-authoring] canvas': {
    pointerEvents: 'none',
  },
  '&[data-native-long-press-haptics]': {
    userSelect: 'auto',
    '& canvas': {
      userSelect: 'auto',
    },
  },
});

const actionButtonClass = css({
  position: 'absolute',
  zIndex: 6,
  display: 'grid',
  placeItems: 'center',
  padding: 0,
  appearance: 'none',
  border: '1px solid rgb(39 48 44 / 18%)',
  borderRadius: '50%',
  background: '#fff',
  boxShadow: '0 7px 22px rgb(45 52 48 / 10%)',
  color: 'rgb(39 48 44 / 72%)',
  transform: 'translate(-50%, -50%)',
  animation: 'bubbleActionEnter 160ms cubic-bezier(0.2, 0.82, 0.2, 1) both',
  backdropFilter: 'blur(10px)',
  WebkitTapHighlightColor: 'transparent',
  _hover: {
    color: '#28312d',
  },
  _active: {
    background: '#f1efe8',
  },
  '[data-theme=dark] &': {
    borderColor: 'rgb(236 242 238 / 14%)',
    background: 'rgb(37 43 40 / 88%)',
    boxShadow: '0 7px 24px rgb(0 0 0 / 20%)',
    color: 'rgb(236 242 238 / 74%)',
    _hover: {
      color: '#f1f4f1',
    },
    _active: {
      background: '#303633',
    },
  },
  transition:
    'border-color 480ms ease, background-color 480ms ease, box-shadow 480ms ease, color 480ms ease',
});

const directActionButtonClass = css({
  cursor: 'pointer',
});

const grabActionButtonClass = css({
  cursor: 'grab',
  _active: {
    cursor: 'grabbing',
  },
});

type ActionStyle = CSSProperties &
  Record<'--action-origin-x' | '--action-origin-y', string>;

function actionStyle(
  center: { x: number; y: number },
  position: { x: number; y: number },
): ActionStyle {
  return {
    left: position.x,
    top: position.y,
    width: THOUGHT_ACTION_SIZE,
    height: THOUGHT_ACTION_SIZE,
    '--action-origin-x': `${center.x - position.x}px`,
    '--action-origin-y': `${center.y - position.y}px`,
  };
}
