import type { Point } from './spatialField';
import type { Thought } from './types';

export type ThoughtAuthoringState =
  | { mode: 'idle' }
  | {
      mode: 'creating';
      screenPosition: Point;
      worldPosition: Point;
      tone: number;
    }
  | {
      mode: 'editing';
      id: string;
      initialText: string;
      screenPosition: Point;
      tone: number;
    };

export type ThoughtAuthoringInput =
  | { type: 'open-create'; screenPosition: Point; worldPosition: Point; tone: number }
  | { type: 'open-edit'; thought: Thought; screenPosition: Point }
  | { type: 'cancel' }
  | { type: 'keep'; text: string };

export type ThoughtAuthoringCommand =
  | { type: 'create-thought'; id: string; text: string; position: Point; tone: number }
  | { type: 'edit-thought'; id: string; text: string };

export type ScreenThought = {
  x: number;
  y: number;
  radius: number;
};

export type FreeThoughtPositionInput = {
  thoughts: ScreenThought[];
  viewport: { width: number; height: number };
  zoom: number;
};

export type ThoughtAuthoring = {
  read: () => ThoughtAuthoringState;
  dispatch: (input: ThoughtAuthoringInput) => ThoughtAuthoringCommand[];
  findFreePosition: (input: FreeThoughtPositionInput) => Point;
};

export function createThoughtAuthoring(): ThoughtAuthoring {
  let state: ThoughtAuthoringState = { mode: 'idle' };

  return {
    read: () => state,
    findFreePosition,
    dispatch(input) {
      switch (input.type) {
        case 'open-create':
          state = {
            mode: 'creating',
            screenPosition: input.screenPosition,
            worldPosition: input.worldPosition,
            tone: input.tone,
          };
          return [];
        case 'open-edit':
          state = {
            mode: 'editing',
            id: input.thought.id,
            initialText: input.thought.text,
            screenPosition: input.screenPosition,
            tone: input.thought.tone,
          };
          return [];
        case 'cancel':
          state = { mode: 'idle' };
          return [];
        case 'keep': {
          const text = input.text.trim();
          if (!text || state.mode === 'idle') return [];
          const command: ThoughtAuthoringCommand =
            state.mode === 'creating'
              ? {
                  type: 'create-thought',
                  id: `thought-${Date.now()}`,
                  text,
                  position: state.worldPosition,
                  tone: state.tone,
                }
              : { type: 'edit-thought', id: state.id, text };
          state = { mode: 'idle' };
          return [command];
        }
      }
    },
  };
}

function findFreePosition({ thoughts, viewport, zoom }: FreeThoughtPositionInput) {
  const composerRadius = Math.min(105, (viewport.width - 32) / 2);
  const collisionRadius = Math.min(72 * zoom, composerRadius);
  const minX = composerRadius + 16;
  const maxX = Math.max(minX, viewport.width - composerRadius - 16);
  const minY = composerRadius + 64;
  const maxY = Math.max(minY, viewport.height - composerRadius - 132);
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);
  const preferred = {
    x: viewport.width / 2,
    y: clamp(viewport.height * 0.46, minY, maxY),
  };
  const visibleThoughts = thoughts.filter(
    (thought) =>
      thought.x + thought.radius >= 0 &&
      thought.x - thought.radius <= viewport.width &&
      thought.y + thought.radius >= 0 &&
      thought.y - thought.radius <= viewport.height,
  );
  if (visibleThoughts.length === 0) return preferred;

  const step = Math.max(24, Math.min(viewport.width, viewport.height) / 12);
  const scanAxis = (min: number, max: number) => {
    const positions = [];
    for (let position = min; position <= max; position += step) {
      positions.push(position);
    }
    if (positions.at(-1) !== max) positions.push(max);
    return positions;
  };
  const candidates = [
    preferred,
    ...scanAxis(minX, maxX).flatMap((x) => scanAxis(minY, maxY).map((y) => ({ x, y }))),
  ];
  const best = candidates.reduce(
    (currentBest, candidate) => {
      const thoughtClearance = visibleThoughts.reduce(
        (closest, thought) =>
          Math.min(
            closest,
            Math.hypot(candidate.x - thought.x, candidate.y - thought.y) -
              thought.radius -
              collisionRadius -
              8,
          ),
        Number.POSITIVE_INFINITY,
      );
      const edgeClearance = Math.min(
        candidate.x - minX,
        maxX - candidate.x,
        candidate.y - minY,
        maxY - candidate.y,
      );
      const clearance = Math.min(thoughtClearance, edgeClearance);
      const preferredDistance = Math.hypot(
        candidate.x - preferred.x,
        candidate.y - preferred.y,
      );
      return clearance > currentBest.clearance ||
        (clearance === currentBest.clearance &&
          preferredDistance < currentBest.preferredDistance)
        ? { position: candidate, clearance, preferredDistance }
        : currentBest;
    },
    {
      position: candidates[0],
      clearance: Number.NEGATIVE_INFINITY,
      preferredDistance: Number.POSITIVE_INFINITY,
    },
  );

  if (best.clearance < 0) {
    return { x: viewport.width / 2, y: viewport.height / 2 };
  }
  return best.position;
}
