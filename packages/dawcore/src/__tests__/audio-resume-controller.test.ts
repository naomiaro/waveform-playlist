import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@waveform-playlist/playout', () => ({
  resumeGlobalAudioContext: vi.fn(() => Promise.resolve()),
}));

import { AudioResumeController } from '../controllers/audio-resume-controller';
import { resumeGlobalAudioContext } from '@waveform-playlist/playout';

let rafCallbacks: Array<(time: number) => void>;

function createMockHost() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  // isConnected is a read-only getter on HTMLElement; add the controller methods directly
  Object.assign(el, {
    addController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
  });
  return el as any;
}

function flushRaf() {
  const cbs = rafCallbacks.splice(0);
  cbs.forEach((cb) => cb(performance.now()));
}

describe('AudioResumeController', () => {
  let host: any;

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallbacks = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: (time: number) => void) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      })
    );
    host = createMockHost();
  });

  afterEach(() => {
    host.remove();
    vi.unstubAllGlobals();
  });

  it('skips listener attachment when target is undefined (inert mode)', () => {
    const addSpy = vi.spyOn(host, 'addEventListener');
    const controller = new AudioResumeController(host);
    controller.hostConnected();
    flushRaf();

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('calls resumeGlobalAudioContext on first pointerdown', () => {
    const controller = new AudioResumeController(host);
    controller.target = '';
    controller.hostConnected();
    flushRaf();

    host.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    expect(resumeGlobalAudioContext).toHaveBeenCalledOnce();
  });

  it('calls resumeGlobalAudioContext on first keydown', () => {
    const controller = new AudioResumeController(host);
    controller.target = '';
    controller.hostConnected();
    flushRaf();

    host.dispatchEvent(new Event('keydown', { bubbles: true }));

    expect(resumeGlobalAudioContext).toHaveBeenCalledOnce();
  });

  it('only calls resume once (second event is no-op)', () => {
    const controller = new AudioResumeController(host);
    controller.target = '';
    controller.hostConnected();
    flushRaf();

    host.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    host.dispatchEvent(new Event('keydown', { bubbles: true }));

    expect(resumeGlobalAudioContext).toHaveBeenCalledOnce();
  });

  it('removes listeners on hostDisconnected before any event fires', () => {
    const removeSpy = vi.spyOn(host, 'removeEventListener');
    const controller = new AudioResumeController(host);
    controller.target = '';
    controller.hostConnected();
    flushRaf();

    controller.hostDisconnected();

    const captureRemovals = removeSpy.mock.calls.filter(
      ([, , opts]) => (opts as any)?.capture === true
    );
    expect(captureRemovals.length).toBe(2);
    expect(resumeGlobalAudioContext).not.toHaveBeenCalled();
  });

  it('attaches to document when target is "document"', () => {
    const docSpy = vi.spyOn(document, 'addEventListener');
    const controller = new AudioResumeController(host);
    controller.target = 'document';
    controller.hostConnected();
    flushRaf();

    document.dispatchEvent(new Event('pointerdown'));

    expect(resumeGlobalAudioContext).toHaveBeenCalledOnce();
    docSpy.mockRestore();
  });

  it('resolves CSS selector target', () => {
    const target = document.createElement('div');
    target.id = 'audio-scope';
    document.body.appendChild(target);

    const targetSpy = vi.spyOn(target, 'addEventListener');
    const controller = new AudioResumeController(host);
    controller.target = '#audio-scope';
    controller.hostConnected();
    flushRaf();

    expect(targetSpy.mock.calls.some(([type]) => type === 'pointerdown')).toBe(true);

    target.remove();
    targetSpy.mockRestore();
  });

  it('falls back to host when selector does not match', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hostSpy = vi.spyOn(host, 'addEventListener');

    const controller = new AudioResumeController(host);
    controller.target = '#nonexistent';
    controller.hostConnected();
    flushRaf();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('#nonexistent'));
    expect(hostSpy.mock.calls.some(([type]) => type === 'pointerdown')).toBe(true);

    warnSpy.mockRestore();
    hostSpy.mockRestore();
  });

  it('skips attachment when host is disconnected before rAF fires', () => {
    const addSpy = vi.spyOn(host, 'addEventListener');
    const controller = new AudioResumeController(host);
    controller.target = '';
    controller.hostConnected();

    // Disconnect before rAF fires
    host.remove();
    flushRaf();

    const captureListeners = addSpy.mock.calls.filter(
      ([, , opts]) => (opts as any)?.capture === true
    );
    expect(captureListeners.length).toBe(0);
  });

  it('logs warning when resumeGlobalAudioContext rejects', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(resumeGlobalAudioContext).mockRejectedValueOnce(new Error('Context closed'));

    const controller = new AudioResumeController(host);
    controller.target = '';
    controller.hostConnected();
    flushRaf();

    host.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    // Allow microtask to settle
    await new Promise((r) => setTimeout(r, 0));

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('eager resume failed'));
    warnSpy.mockRestore();
  });

  it('warns and becomes inert on invalid CSS selector', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const addSpy = vi.spyOn(host, 'addEventListener');

    const controller = new AudioResumeController(host);
    controller.target = '[invalid';
    controller.hostConnected();
    flushRaf();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('failed to resolve target'));
    const captureListeners = addSpy.mock.calls.filter(
      ([, , opts]) => (opts as any)?.capture === true
    );
    expect(captureListeners.length).toBe(0);

    warnSpy.mockRestore();
  });

  it('ignores stale rAF from previous hostConnected after disconnect/reconnect', () => {
    const addSpy = vi.spyOn(host, 'addEventListener');
    const controller = new AudioResumeController(host);
    controller.target = '';

    // First connect schedules rAF-A
    controller.hostConnected();
    // Disconnect invalidates rAF-A
    controller.hostDisconnected();
    // Reconnect schedules rAF-B
    controller.hostConnected();
    // Both rAFs fire — only rAF-B should attach listeners
    flushRaf();

    const captureListeners = addSpy.mock.calls.filter(
      ([, , opts]) => (opts as any)?.capture === true
    );
    // Exactly 2 listeners (pointerdown + keydown), not 4
    expect(captureListeners.length).toBe(2);
  });
});
