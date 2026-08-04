import { describe, expect, it } from 'vitest';

import { initialSpace } from './initialSpace';
import {
  loadStoredSpace,
  saveStoredSpace,
  SPACE_STORAGE_KEY,
  type SpaceStorage,
} from './spaceStorage';

function memoryStorage(initialValue?: string): SpaceStorage {
  const values = new Map<string, string>();
  if (initialValue !== undefined) values.set(SPACE_STORAGE_KEY, initialValue);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('space storage', () => {
  it('round-trips the spatial field', () => {
    const storage = memoryStorage();

    expect(saveStoredSpace(storage, initialSpace)).toBe(true);
    expect(loadStoredSpace(storage)).toEqual(initialSpace);
  });

  it('ignores malformed or structurally invalid data', () => {
    expect(loadStoredSpace(memoryStorage('{broken'))).toBeNull();
    expect(
      loadStoredSpace(
        memoryStorage(
          JSON.stringify({
            thoughts: [],
            attachments: [['missing', 'also-missing']],
          }),
        ),
      ),
    ).toBeNull();
  });

  it('tolerates unavailable browser storage', () => {
    const unavailable: SpaceStorage = {
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('unavailable');
      },
    };

    expect(loadStoredSpace(unavailable)).toBeNull();
    expect(saveStoredSpace(unavailable, initialSpace)).toBe(false);
  });
});
