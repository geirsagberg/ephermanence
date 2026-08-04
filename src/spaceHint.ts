import type { SpaceState } from './types';

export function hintForSpace(state: SpaceState, isDragging = false) {
  if (state.thoughts.length <= 1) return 'Double click or press Enter';
  if (state.thoughts.length !== 2) return null;

  const [first, second] = state.thoughts;
  const attached = state.attachments.some(
    ([a, b]) =>
      (a === first.id && b === second.id) || (a === second.id && b === first.id),
  );
  if (attached) return null;
  return isDragging ? 'Touch another thought' : 'Drag to connect';
}
