import { describe, it, expect, vi } from 'vitest';

// Guards the setup file in ./setup/wait-timeout.ts: without it these waits
// would hit vitest's 1 s default and this file would fail.
describe('vi.waitFor default ceiling (test setup)', () => {
  it("keeps polling past vitest's 1 s default", async () => {
    const readyAt = Date.now() + 1300;

    await vi.waitFor(() => {
      expect(Date.now()).toBeGreaterThanOrEqual(readyAt);
    });
  });

  it('still honours an explicit timeout', async () => {
    await expect(
      vi.waitFor(
        () => {
          throw new Error('never ready');
        },
        { timeout: 60 }
      )
    ).rejects.toThrow('never ready');
  });
});
