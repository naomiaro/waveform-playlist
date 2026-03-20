import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@waveform-playlist/playout', () => ({
  resumeGlobalAudioContext: vi.fn(),
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
});
