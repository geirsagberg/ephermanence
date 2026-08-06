import type { Attachment, SpaceState, Thought } from './types';

export type Point = { x: number; y: number };

export type SpatialFieldInput =
  | {
      type: 'thought-pointer-down';
      id: string;
      point: Point;
      singular: boolean;
      detachOnTap?: boolean;
    }
  | { type: 'pointer-move'; point: Point; zoom: number }
  | { type: 'pointer-up' }
  | { type: 'clear-selection' }
  | { type: 'delete-selection' }
  | { type: 'edit-thought'; id: string; text: string }
  | { type: 'create-thought'; id: string; text: string; position: Point; tone: number };

export type SpatialFieldSnapshot = {
  state: SpaceState;
  selectedId: string | null;
  grabbedThoughtId: string | null;
  attachmentCandidateIds: string[];
  isDragging: boolean;
};

type Drag = {
  activeId: string;
  distance: number;
  started: boolean;
  lastPoint: Point;
  movingIds: Set<string>;
  singular: boolean;
  detachOnTap: boolean;
};

export type SpatialField = {
  read: () => SpatialFieldSnapshot;
  dispatch: (input: SpatialFieldInput) => SpatialFieldSnapshot;
};

export function createSpatialField(initialState: SpaceState): SpatialField {
  let state = initialState;
  let selectedId: string | null = null;
  let attachmentCandidateIds: string[] = [];
  let drag: Drag | null = null;
  let snapshot: SpatialFieldSnapshot = {
    state,
    selectedId,
    grabbedThoughtId: null,
    attachmentCandidateIds,
    isDragging: false,
  };

  const read = () => snapshot;

  return {
    read,
    dispatch(input) {
      switch (input.type) {
        case 'thought-pointer-down': {
          attachmentCandidateIds = [];
          if (input.singular) {
            state = {
              ...state,
              thoughts: bringThoughtToFront(state.thoughts, input.id),
            };
          }
          drag = {
            activeId: input.id,
            distance: 0,
            started: false,
            lastPoint: input.point,
            movingIds: input.singular
              ? new Set([input.id])
              : connectedThoughtIds(input.id, state.attachments),
            singular: input.singular,
            detachOnTap: input.detachOnTap ?? false,
          };
          break;
        }
        case 'pointer-move': {
          if (!drag) break;
          const dx = input.point.x - drag.lastPoint.x;
          const dy = input.point.y - drag.lastPoint.y;
          drag.distance += Math.hypot(dx, dy);
          const dragBegan = !drag.started && drag.distance >= 4;
          if (dragBegan) {
            drag.started = true;
            selectedId = null;
          }
          drag.lastPoint = input.point;

          const thoughts = translateThoughts(
            dragBegan
              ? bringThoughtToFrontWhenAlone(
                  state.thoughts,
                  state.attachments,
                  drag.activeId,
                )
              : state.thoughts,
            drag.movingIds,
            dx / input.zoom,
            dy / input.zoom,
          );
          state = { ...state, thoughts };
          attachmentCandidateIds = drag.started
            ? findAttachmentCandidateIds(
                thoughts,
                state.attachments,
                drag.movingIds,
                drag.singular,
              )
            : [];
          break;
        }
        case 'pointer-up': {
          if (!drag) break;
          if (drag.distance < 4) {
            if (drag.detachOnTap) {
              const activeId = drag.activeId;
              state = {
                ...state,
                attachments: state.attachments.filter(
                  ([a, b]) => a !== activeId && b !== activeId,
                ),
              };
            } else {
              state = {
                ...state,
                thoughts: bringThoughtToFront(state.thoughts, drag.activeId),
              };
              selectedId = drag.activeId;
            }
          } else {
            state = {
              ...state,
              attachments: recalculateAttachments(
                state.thoughts,
                state.attachments,
                drag.movingIds,
                drag.singular,
              ),
            };
          }
          drag = null;
          attachmentCandidateIds = [];
          break;
        }
        case 'clear-selection': {
          selectedId = null;
          break;
        }
        case 'delete-selection': {
          if (!selectedId) break;
          state = {
            thoughts: state.thoughts.filter((thought) => thought.id !== selectedId),
            attachments: state.attachments.filter(
              ([a, b]) => a !== selectedId && b !== selectedId,
            ),
          };
          selectedId = null;
          break;
        }
        case 'edit-thought': {
          const thoughts = state.thoughts.map((thought) => ({
            ...thought,
            ...(thought.id === input.id
              ? { text: input.text, radius: thoughtRadius(input.text) }
              : {}),
          }));
          state = {
            thoughts,
            attachments: recalculateAttachments(
              thoughts,
              state.attachments,
              new Set([input.id]),
              true,
            ),
          };
          break;
        }
        case 'create-thought': {
          state = {
            ...state,
            thoughts: [
              ...state.thoughts,
              {
                id: input.id,
                text: input.text,
                ...input.position,
                radius: thoughtRadius(input.text),
                tone: input.tone,
              },
            ],
          };
          selectedId = null;
          break;
        }
      }

      if (
        state !== snapshot.state ||
        selectedId !== snapshot.selectedId ||
        (drag?.singular ? drag.activeId : null) !== snapshot.grabbedThoughtId ||
        attachmentCandidateIds !== snapshot.attachmentCandidateIds ||
        Boolean(drag?.started) !== snapshot.isDragging
      ) {
        snapshot = {
          state,
          selectedId,
          grabbedThoughtId: drag?.singular ? drag.activeId : null,
          attachmentCandidateIds,
          isDragging: Boolean(drag?.started),
        };
      }
      return snapshot;
    },
  };
}

function bringThoughtToFront(thoughts: Thought[], id: string) {
  const selected = thoughts.find((thought) => thought.id === id);
  if (!selected || thoughts.at(-1)?.id === id) return thoughts;
  return [...thoughts.filter((thought) => thought.id !== id), selected];
}

function bringThoughtToFrontWhenAlone(
  thoughts: Thought[],
  attachments: Attachment[],
  id: string,
) {
  const attached = attachments.some(([a, b]) => a === id || b === id);
  return attached ? thoughts : bringThoughtToFront(thoughts, id);
}

export function thoughtRadius(text: string) {
  const minimumRadius = 64;
  const maximumRadius = 144;
  const areaPerCharacter = 65;
  const radius = Math.sqrt(minimumRadius ** 2 + text.length * areaPerCharacter);
  return Math.min(maximumRadius, radius);
}

export function connectedThoughtIds(id: string, attachments: Attachment[]) {
  const result = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b] of attachments) {
      if (result.has(a) && !result.has(b)) {
        result.add(b);
        changed = true;
      }
      if (result.has(b) && !result.has(a)) {
        result.add(a);
        changed = true;
      }
    }
  }
  return result;
}

function translateThoughts(
  thoughts: Thought[],
  movingIds: Set<string>,
  dx: number,
  dy: number,
) {
  return thoughts.map((thought) =>
    movingIds.has(thought.id)
      ? { ...thought, x: thought.x + dx, y: thought.y + dy }
      : thought,
  );
}

function attachmentKey([a, b]: Attachment) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function areTouching(a: Thought, b: Thought) {
  return Math.hypot(b.x - a.x, b.y - a.y) <= a.radius + b.radius;
}

function findAttachmentCandidateIds(
  thoughts: Thought[],
  attachments: Attachment[],
  movedIds: Set<string>,
  singular: boolean,
) {
  const retained = retainAttachments(attachments, movedIds, singular);
  const additions = findNewAttachments(thoughts, retained, movedIds);
  return [...new Set(additions.map(([, targetId]) => targetId))];
}

function retainAttachments(
  attachments: Attachment[],
  movedIds: Set<string>,
  singular: boolean,
) {
  return singular
    ? attachments.filter(([a, b]) => !movedIds.has(a) && !movedIds.has(b))
    : [...attachments];
}

function findNewAttachments(
  thoughts: Thought[],
  attachments: Attachment[],
  movedIds: Set<string>,
) {
  const keys = new Set(attachments.map(attachmentKey));
  const additions: Attachment[] = [];

  for (let index = 0; index < thoughts.length; index += 1) {
    const a = thoughts[index];
    for (let targetIndex = index + 1; targetIndex < thoughts.length; targetIndex += 1) {
      const b = thoughts[targetIndex];
      const aIsMoving = movedIds.has(a.id);
      if (aIsMoving === movedIds.has(b.id) || !areTouching(a, b)) continue;

      const attachment: Attachment = aIsMoving ? [a.id, b.id] : [b.id, a.id];
      const key = attachmentKey(attachment);
      if (keys.has(key)) continue;
      keys.add(key);
      additions.push(attachment);
    }
  }

  return additions;
}

function recalculateAttachments(
  thoughts: Thought[],
  attachments: Attachment[],
  movedIds: Set<string>,
  singular: boolean,
) {
  const retained = retainAttachments(attachments, movedIds, singular);
  return [...retained, ...findNewAttachments(thoughts, retained, movedIds)];
}
