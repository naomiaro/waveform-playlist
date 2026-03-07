import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Shared mock state that each test can configure
const mockRawContext = {
  state: 'suspended' as AudioContextState,
};

const mockResume = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);

// Track how many Context instances are created
let contextCreateCount = 0;

vi.mock('tone', () => {
  // Use a named function so it can be called with `new`
  const MockContext = vi.fn(function (this: Record<string, unknown>) {
    contextCreateCount++;
    this.rawContext = mockRawContext;
    this.resume = mockResume;
    this.close = mockClose;
    // Define state as a getter so it always reflects current mockRawContext.state
    Object.defineProperty(this, 'state', {
      get: () => mockRawContext.state,
      enumerable: true,
      configurable: true,
    });
  });
  return {
    Context: MockContext,
    setContext: vi.fn(),
  };
});

// Must import AFTER vi.mock
import {
  getGlobalContext,
  getGlobalAudioContext,
  getGlobalAudioContextState,
  resumeGlobalAudioContext,
  closeGlobalAudioContext,
} from '../audioContext';
import { Context, setContext } from 'tone';

describe('audioContext singleton', () => {
  beforeEach(async () => {
    // Reset singleton state between tests
    // Set state to non-closed so closeGlobalAudioContext actually resets
    mockRawContext.state = 'running';
    await closeGlobalAudioContext();
    vi.clearAllMocks();
    contextCreateCount = 0;
    // Reset mock state to default
    mockRawContext.state = 'suspended';
  });

  afterEach(async () => {
    mockRawContext.state = 'running';
    await closeGlobalAudioContext();
  });

  describe('getGlobalContext', () => {
    it('returns a Tone.js Context instance', () => {
      const context = getGlobalContext();
      expect(context).toBeDefined();
      expect(context.rawContext).toBe(mockRawContext);
      expect(Context).toHaveBeenCalledOnce();
    });

    it('calls setContext with the created context', () => {
      const context = getGlobalContext();
      expect(setContext).toHaveBeenCalledWith(context);
    });

    it('returns the same instance on multiple calls (singleton)', () => {
      const first = getGlobalContext();
      const second = getGlobalContext();
      const third = getGlobalContext();
      expect(first).toBe(second);
      expect(second).toBe(third);
      expect(contextCreateCount).toBe(1);
    });
  });

  describe('getGlobalAudioContext', () => {
    it('returns the rawContext from the Tone.js Context', () => {
      const rawContext = getGlobalAudioContext();
      expect(rawContext).toBe(mockRawContext);
    });

    it('returns the same rawContext on multiple calls', () => {
      const first = getGlobalAudioContext();
      const second = getGlobalAudioContext();
      expect(first).toBe(second);
    });

    it('creates the context if not yet initialized', () => {
      getGlobalAudioContext();
      expect(Context).toHaveBeenCalledOnce();
    });
  });

  describe('getGlobalAudioContextState', () => {
    it('returns "suspended" when context has not been created', () => {
      // No context created yet, globalToneContext is null
      const state = getGlobalAudioContextState();
      expect(state).toBe('suspended');
    });

    it('returns the rawContext state when context exists', () => {
      getGlobalContext(); // Create the context
      mockRawContext.state = 'running';
      expect(getGlobalAudioContextState()).toBe('running');
    });

    it('reflects state changes', () => {
      getGlobalContext();
      mockRawContext.state = 'suspended';
      expect(getGlobalAudioContextState()).toBe('suspended');

      mockRawContext.state = 'running';
      expect(getGlobalAudioContextState()).toBe('running');

      mockRawContext.state = 'closed';
      expect(getGlobalAudioContextState()).toBe('closed');
    });
  });

  describe('resumeGlobalAudioContext', () => {
    it('calls resume when context state is not running', async () => {
      mockRawContext.state = 'suspended';
      await resumeGlobalAudioContext();
      expect(mockResume).toHaveBeenCalledOnce();
    });

    it('does not call resume when context is already running', async () => {
      mockRawContext.state = 'running';
      getGlobalContext(); // Ensure context exists
      await resumeGlobalAudioContext();
      expect(mockResume).not.toHaveBeenCalled();
    });

    it('creates the context if not yet initialized', async () => {
      mockRawContext.state = 'suspended';
      await resumeGlobalAudioContext();
      expect(Context).toHaveBeenCalled();
    });
  });

  describe('closeGlobalAudioContext', () => {
    it('calls close on the context', async () => {
      getGlobalContext(); // Create the context
      mockRawContext.state = 'running';
      await closeGlobalAudioContext();
      expect(mockClose).toHaveBeenCalledOnce();
    });

    it('does not call close if context is already closed', async () => {
      getGlobalContext();
      mockRawContext.state = 'closed';
      await closeGlobalAudioContext();
      expect(mockClose).not.toHaveBeenCalled();
    });

    it('is safe to call when no context exists', async () => {
      // No context created — should not throw
      await expect(closeGlobalAudioContext()).resolves.toBeUndefined();
    });

    it('resets singleton so next call creates a fresh context', async () => {
      getGlobalContext();
      expect(contextCreateCount).toBe(1);

      mockRawContext.state = 'running';
      await closeGlobalAudioContext();

      // Next call should create a new context
      getGlobalContext();
      expect(contextCreateCount).toBe(2);
      expect(Context).toHaveBeenCalledTimes(2);
    });
  });
});
