import { describe, it, expect, vi, afterEach } from 'vitest';
import '../index';
import {
  resolveTransportTarget,
  targetSupports,
  warnOnce,
  warnUnsupportedOnce,
} from '../utils/transport-capability';

describe('targetSupports', () => {
  it('returns false for null/undefined targets', () => {
    expect(targetSupports(null, ['play'])).toBe(false);
    expect(targetSupports(undefined, ['play'])).toBe(false);
  });

  it('returns true when every required name is a function', () => {
    const target = { play: () => {}, stop: () => {} };
    expect(targetSupports(target, ['play', 'stop'])).toBe(true);
  });

  it('returns false when any required name is missing or not a function', () => {
    const target = { play: () => {}, undo: 'not-a-function' };
    expect(targetSupports(target, ['play', 'undo'])).toBe(false);
    expect(targetSupports(target, ['redo'])).toBe(false);
  });

  it('returns true for an empty requirement list on a non-null target', () => {
    expect(targetSupports({}, [])).toBe(true);
  });
});

describe('warnOnce', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('distinct messages on the same element each warn once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = document.createElement('div');
    warnOnce(el, 'message A');
    warnOnce(el, 'message A');
    warnOnce(el, 'message B');
    warnOnce(el, 'message B');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toBe('message A');
    expect(warn.mock.calls[1][0]).toBe('message B');
  });
});

describe('warnUnsupportedOnce', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns once per element, naming the missing methods', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = document.createElement('daw-record-button');
    warnUnsupportedOnce(el, ['startRecording', 'stopRecording']);
    warnUnsupportedOnce(el, ['startRecording', 'stopRecording']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('daw-record-button');
    expect(warn.mock.calls[0][0]).toContain('startRecording');
  });

  it('warns separately for distinct elements', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnUnsupportedOnce(document.createElement('div'), ['a']);
    warnUnsupportedOnce(document.createElement('div'), ['a']);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('resolveTransportTarget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves through the closest daw-transport for attribute', () => {
    const fakeEditor = document.createElement('div');
    fakeEditor.id = 'ed-1';
    document.body.appendChild(fakeEditor);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="ed-1"><daw-play-button></daw-play-button></daw-transport>'
    );
    const button = document.querySelector('daw-play-button')!;
    expect(resolveTransportTarget(button)).toBe(fakeEditor);
  });

  it('returns null outside a transport or with a dangling id', () => {
    const orphan = document.createElement('daw-play-button');
    document.body.appendChild(orphan);
    expect(resolveTransportTarget(orphan)).toBeNull();

    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="missing"><daw-stop-button></daw-stop-button></daw-transport>'
    );
    expect(resolveTransportTarget(document.querySelector('daw-stop-button')!)).toBeNull();
  });
});
