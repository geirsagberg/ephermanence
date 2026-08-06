import { describe, expect, it } from 'vitest';

import { initialSpace } from './initialSpace';
import { parseSpaceImport, serializeSpaceExport } from './spaceTransfer';

describe('space transfer', () => {
  it('round-trips a versioned Ephermanence export', () => {
    expect(parseSpaceImport(serializeSpaceExport(initialSpace))).toEqual(initialSpace);
  });

  it('accepts the raw space shape used by existing storage', () => {
    expect(parseSpaceImport(JSON.stringify(initialSpace))).toEqual(initialSpace);
  });

  it('rejects malformed exports and unsupported versions', () => {
    expect(parseSpaceImport('{broken')).toBeNull();
    expect(
      parseSpaceImport(
        JSON.stringify({
          format: 'ephermanence-space',
          version: 2,
          space: initialSpace,
        }),
      ),
    ).toBeNull();
  });
});
