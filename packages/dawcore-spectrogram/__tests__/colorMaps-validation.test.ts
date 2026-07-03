import { describe, it, expect } from 'vitest';
import { getColorMap } from '../src/computation/colorMaps';

describe('getColorMap — custom stops validation (#558)', () => {
  it('throws a clear error for an empty stops array instead of an opaque TypeError', () => {
    expect(() => getColorMap([])).toThrow(/at least one color stop/i);
  });
});
