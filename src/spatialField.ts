import { thoughtRadius } from './thoughtTextLayout';
import type { Attachment, SpaceState, Thought } from './types';

export type Point = { x: number; y: number };

export type SpatialFieldInput =
  | {
      type: 'thought-pointer-down';
      id: string;
      point: Point;
      pointerId: number;
      singular: boolean;
      detachOnTap?: boolean;
    }
  | { type: 'pointer-move'; pointerId: number; point: Point; zoom: number }
  | { type: 'pointer-up'; pointerId: number }
  | { type: 'pointer-cancel'; pointerId: number }
  | { type: 'clear-selection' }
  | { type: 'delete-selection' }
  | { type: 'edit-thought'; id: string; text: string }
  | { type: 'create-thought'; id: string; text: string; position: Point; tone: number }
  | { type: 'replace-space'; state: SpaceState };

export type SpatialFieldSnapshot = {
  state: SpaceState;
  selectedId: string | null;
  independentlyMovingThoughtIds: string[];
  attachmentCandidateIds: string[];
  isDragging: boolean;
};

type Drag = {
  order: number;
  activeId: string;
  distance: number;
  started: boolean;
  lastPoint: Point;
  movingIds: Set<string>;
  independent: boolean;
  detachOnTap: boolean;
  raiseOnDragStart: boolean;
};

export type SpatialField = {
  read: () => SpatialFieldSnapshot;
  dispatch: (input: SpatialFieldInput) => SpatialFieldSnapshot;
};

export function createSpatialField(initialState: SpaceState): SpatialField {
  let state = initialState;
  let selectedId: string | null = null;
  let attachmentCandidateIds: string[] = [];
  const drags = new Map<number, Drag>();
  let nextDragOrder = 0;
  let snapshot: SpatialFieldSnapshot = {
    state,
    selectedId,
    independentlyMovingThoughtIds: [],
    attachmentCandidateIds,
    isDragging: false,
  };

  const read = () => snapshot;

  return {
    read,
    dispatch(input) {
      switch (input.type) {
        case 'thought-pointer-down': {
          drags.delete(input.pointerId);
          const previousOwner = findDragOwningThought(drags, input.id);
          const independent = input.singular || Boolean(previousOwner);
          if (previousOwner) previousOwner.movingIds.delete(input.id);
          if (input.singular) {
            state = {
              ...state,
              thoughts: bringThoughtToFront(state.thoughts, input.id),
            };
          }
          const ownedIds = new Set(
            [...drags.values()].flatMap(({ movingIds }) => [...movingIds]),
          );
          drags.set(input.pointerId, {
            order: nextDragOrder,
            activeId: input.id,
            distance: 0,
            started: false,
            lastPoint: input.point,
            movingIds: independent
              ? new Set([input.id])
              : new Set(
                  [...connectedThoughtIds(input.id, state.attachments)].filter(
                    (id) => !ownedIds.has(id),
                  ),
                ),
            independent,
            detachOnTap: input.detachOnTap ?? false,
            raiseOnDragStart: !state.attachments.some(
              ([a, b]) => a === input.id || b === input.id,
            ),
          });
          nextDragOrder += 1;
          attachmentCandidateIds = dragAttachmentCandidateIds(state, drags);
          break;
        }
        case 'pointer-move': {
          const drag = drags.get(input.pointerId);
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
            dragBegan && drag.raiseOnDragStart
              ? bringThoughtToFront(state.thoughts, drag.activeId)
              : state.thoughts,
            drag.movingIds,
            dx / input.zoom,
            dy / input.zoom,
          );
          state = { ...state, thoughts };
          attachmentCandidateIds = dragAttachmentCandidateIds(state, drags);
          break;
        }
        case 'pointer-up': {
          const drag = drags.get(input.pointerId);
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
              ),
            };
          }
          drags.delete(input.pointerId);
          transferReleasedDragToOldestAttachedDrag(drag, drags, state.attachments);
          attachmentCandidateIds = dragAttachmentCandidateIds(state, drags);
          break;
        }
        case 'pointer-cancel': {
          drags.delete(input.pointerId);
          attachmentCandidateIds = dragAttachmentCandidateIds(state, drags);
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
            ...(thought.id === input.id ? { text: input.text } : {}),
          }));
          state = {
            thoughts,
            attachments: recalculateAttachments(
              thoughts,
              state.attachments,
              new Set([input.id]),
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
                tone: input.tone,
              },
            ],
          };
          selectedId = null;
          break;
        }
        case 'replace-space': {
          state = input.state;
          selectedId = null;
          attachmentCandidateIds = [];
          drags.clear();
          break;
        }
      }

      const independentlyMovingThoughtIds = [...drags.values()]
        .filter(({ independent }) => independent)
        .map(({ activeId }) => activeId);
      if (
        state !== snapshot.state ||
        selectedId !== snapshot.selectedId ||
        !sameIds(independentlyMovingThoughtIds, snapshot.independentlyMovingThoughtIds) ||
        attachmentCandidateIds !== snapshot.attachmentCandidateIds ||
        [...drags.values()].some(({ started }) => started) !== snapshot.isDragging
      ) {
        snapshot = {
          state,
          selectedId,
          independentlyMovingThoughtIds,
          attachmentCandidateIds,
          isDragging: [...drags.values()].some(({ started }) => started),
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

function findDragOwningThought(drags: Map<number, Drag>, id: string) {
  return [...drags.values()].find(({ movingIds }) => movingIds.has(id));
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function dragAttachmentCandidateIds(state: SpaceState, drags: Map<number, Drag>) {
  return [
    ...new Set(
      [...drags.values()]
        .filter(({ started }) => started)
        .flatMap(({ movingIds }) =>
          findAttachmentCandidateIds(state.thoughts, state.attachments, movingIds),
        ),
    ),
  ];
}

function transferReleasedDragToOldestAttachedDrag(
  released: Drag,
  drags: Map<number, Drag>,
  attachments: Attachment[],
) {
  const recipient = [...drags.values()]
    .filter(({ movingIds }) =>
      attachments.some(
        ([a, b]) =>
          (released.movingIds.has(a) && movingIds.has(b)) ||
          (released.movingIds.has(b) && movingIds.has(a)),
      ),
    )
    .sort((left, right) => left.order - right.order)[0];
  if (!recipient) return;
  for (const id of released.movingIds) recipient.movingIds.add(id);
}

function attachmentKey([a, b]: Attachment) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function areTouching(a: Thought, b: Thought, aRadius: number, bRadius: number) {
  return Math.hypot(b.x - a.x, b.y - a.y) <= aRadius + bRadius;
}

function findAttachmentCandidateIds(
  thoughts: Thought[],
  attachments: Attachment[],
  movedIds: Set<string>,
) {
  const retained = retainAttachments(attachments, movedIds);
  const additions = findNewAttachments(thoughts, retained, movedIds);
  return [...new Set(additions.map(([, targetId]) => targetId))];
}

function retainAttachments(attachments: Attachment[], movedIds: Set<string>) {
  return attachments.filter(([a, b]) => movedIds.has(a) === movedIds.has(b));
}

function findNewAttachments(
  thoughts: Thought[],
  attachments: Attachment[],
  movedIds: Set<string>,
) {
  const keys = new Set(attachments.map(attachmentKey));
  const additions: Attachment[] = [];
  const radii = thoughts.map((thought) => thoughtRadius(thought.text));

  for (let index = 0; index < thoughts.length; index += 1) {
    const a = thoughts[index];
    for (let targetIndex = index + 1; targetIndex < thoughts.length; targetIndex += 1) {
      const b = thoughts[targetIndex];
      const aIsMoving = movedIds.has(a.id);
      if (
        aIsMoving === movedIds.has(b.id) ||
        !areTouching(a, b, radii[index], radii[targetIndex])
      )
        continue;

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
) {
  const retained = retainAttachments(attachments, movedIds);
  return [...retained, ...findNewAttachments(thoughts, retained, movedIds)];
}
