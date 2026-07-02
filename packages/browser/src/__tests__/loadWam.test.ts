import { describe, it, expect, vi } from 'vitest';

vi.mock('@dawcore/wam', () => ({
  ensureWamHost: vi.fn(),
  createWamInstance: vi.fn(),
  createWamInstanceFromFactory: vi.fn(),
  loadWamFactory: vi.fn(),
  cloneInstanceInto: vi.fn(),
  createParameterPanel: vi.fn(),
  createWamParameterPanel: vi.fn(),
  fetchWamLibrary: vi.fn(),
  fetchWamDescriptor: vi.fn(),
  createWamTransportBridge: vi.fn(),
}));

describe('loadWamModule', () => {
  it('resolves the module when @dawcore/wam is installed', async () => {
    const { loadWamModule } = await import('../effects/loadWam');
    const mod = await loadWamModule();
    expect(typeof mod.ensureWamHost).toBe('function');
  });
});
