import { describe, it, expect, vi } from 'vitest';

vi.mock('@dawcore/wam', () => {
  throw new Error("Cannot find module '@dawcore/wam'");
});

describe('loadWamModule without the optional peer', () => {
  it('rethrows with an install hint', async () => {
    const { loadWamModule } = await import('../effects/loadWam');
    await expect(loadWamModule()).rejects.toThrow(/npm install @dawcore\/wam/);
  });
});
