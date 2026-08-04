import type { SpaceState, Thought } from './types';

export const SPACE_STORAGE_KEY = 'ephermanence.space.v1';

export type SpaceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function loadStoredSpace(storage: SpaceStorage | null): SpaceState | null {
  if (!storage) return null;

  try {
    const stored = storage.getItem(SPACE_STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isSpaceState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStoredSpace(
  storage: SpaceStorage | null,
  state: SpaceState,
): boolean {
  if (!storage) return false;

  try {
    storage.setItem(SPACE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function isSpaceState(value: unknown): value is SpaceState {
  if (!isRecord(value) || !Array.isArray(value.thoughts)) return false;
  if (!Array.isArray(value.attachments) || !value.thoughts.every(isThought)) {
    return false;
  }

  const ids = new Set(value.thoughts.map(({ id }) => id));
  if (ids.size !== value.thoughts.length) return false;

  return value.attachments.every((attachment) => {
    return (
      Array.isArray(attachment) &&
      attachment.length === 2 &&
      typeof attachment[0] === 'string' &&
      typeof attachment[1] === 'string' &&
      ids.has(attachment[0]) &&
      ids.has(attachment[1])
    );
  });
}

function isThought(value: unknown): value is Thought {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.radius) &&
    value.radius > 0 &&
    isFiniteNumber(value.tone)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
