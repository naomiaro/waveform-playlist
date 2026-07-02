import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const contextInstances: unknown[] = [];
const MockContext = vi.fn(function (this: { rawContext: unknown }, raw?: unknown) {
  this.rawContext = raw ?? { sampleRate: 48000, state: 'suspended' };
  contextInstances.push(this);
});
const setContext = vi.fn();

vi.mock('tone', () => ({
  Context: MockContext,
  setContext: (...args: unknown[]) => setContext(...args),
}));

class FakeAudioListener {}
Object.defineProperty(FakeAudioListener.prototype, 'positionX', {
  get() {
    return {};
  },
  configurable: true,
});

class FakeAudioContext {
  sampleRate: number;
  state = 'suspended';
  constructor(opts?: { sampleRate?: number }) {
    this.sampleRate = opts?.sampleRate ?? 48000;
  }
}

describe('native AudioContext mode', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    contextInstances.length = 0;
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('AudioListener', FakeAudioListener);
    const mod = await import('../audioContext');
    mod._resetGlobalContextForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates the Tone Context around a native AudioContext when nativeAudioContext is set', async () => {
    const { configureGlobalContext, isNativeGlobalContext, getGlobalAudioContext } = await import(
      '../audioContext'
    );
    configureGlobalContext({ nativeAudioContext: true });
    expect(isNativeGlobalContext()).toBe(true);
    expect(getGlobalAudioContext()).toBeInstanceOf(FakeAudioContext);
    // Context was constructed WITH the native context (not argless)
    expect(MockContext.mock.calls[0][0]).toBeInstanceOf(FakeAudioContext);
  });

  it('passes sampleRate to the native constructor', async () => {
    const { configureGlobalContext, getGlobalAudioContext } = await import('../audioContext');
    const rate = configureGlobalContext({ nativeAudioContext: true, sampleRate: 44100 });
    expect(rate).toBe(44100);
    expect((getGlobalAudioContext() as unknown as FakeAudioContext).sampleRate).toBe(44100);
  });

  it('falls back to the default (SAC) context and warns when AudioListener params are missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    class NoParamsListener {}
    vi.stubGlobal('AudioListener', NoParamsListener);
    const { configureGlobalContext, isNativeGlobalContext } = await import('../audioContext');
    configureGlobalContext({ nativeAudioContext: true });
    expect(isNativeGlobalContext()).toBe(false);
    expect(MockContext.mock.calls[0]).toEqual([]); // argless = SAC path
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('AudioListener'));
    warn.mockRestore();
  });

  it('warns and keeps the existing context when called after context creation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { configureGlobalContext, getGlobalContext, isNativeGlobalContext } = await import(
      '../audioContext'
    );
    getGlobalContext(); // create default context first
    configureGlobalContext({ nativeAudioContext: true });
    expect(isNativeGlobalContext()).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('already created'));
    warn.mockRestore();
  });

  it('isNativeGlobalContext is false by default', async () => {
    const { getGlobalContext, isNativeGlobalContext } = await import('../audioContext');
    getGlobalContext();
    expect(isNativeGlobalContext()).toBe(false);
  });
});
