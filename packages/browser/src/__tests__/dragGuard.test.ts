import { describe, it, expect } from 'vitest';
import { createDragGuard } from '../providerInternals/dragGuard';

describe('createDragGuard (#848)', () => {
  it('is active from begin until its end', () => {
    const guard = createDragGuard();
    expect(guard.active).toBe(false);
    const end = guard.begin();
    expect(guard.active).toBe(true);
    end();
    expect(guard.active).toBe(false);
  });

  it('an end called twice ends one begin only', () => {
    const guard = createDragGuard();
    const endFirst = guard.begin();
    const endSecond = guard.begin();
    endFirst();
    endFirst();
    expect(guard.active).toBe(true);
    endSecond();
    expect(guard.active).toBe(false);
  });
});
