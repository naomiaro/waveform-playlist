import { describe, it, expect, vi, afterEach } from 'vitest';
import { isDevelopmentBuild } from '../isDevelopmentBuild';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isDevelopmentBuild', () => {
  it('is true under the test runner', () => {
    expect(isDevelopmentBuild()).toBe(true);
  });

  it('is false in a production build', () => {
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(isDevelopmentBuild()).toBe(false);
    } finally {
      process.env.NODE_ENV = before;
    }
  });

  it('is false, and does not throw, where there is no `process` at all', () => {
    vi.stubGlobal('process', undefined);
    expect(isDevelopmentBuild()).toBe(false);
  });
});
