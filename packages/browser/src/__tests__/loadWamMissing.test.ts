import { describe, it, expect, vi } from 'vitest';
import { installSpecs } from '../../../../scripts/build/install-specs.mjs';

// The range browser's published manifest has for each peer (#884).
const specs = installSpecs('browser');

vi.mock('@dawcore/wam', () => {
  throw new Error("Cannot find module '@dawcore/wam'");
});

describe('loadWamModule without the optional peer', () => {
  it('rethrows with an install hint', async () => {
    const { loadWamModule } = await import('../effects/loadWam');
    await expect(loadWamModule()).rejects.toThrow(`npm install "${specs['@dawcore/wam']}"`);
  });
});
