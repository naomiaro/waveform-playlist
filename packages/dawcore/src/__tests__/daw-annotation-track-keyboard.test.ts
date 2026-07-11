import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../elements/daw-annotation';
import '../elements/daw-annotation-track';
import type { DawAnnotationTrackElement } from '../elements/daw-annotation-track';

const flush = () => new Promise((r) => setTimeout(r, 0));

const key = (k: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });

describe('<daw-annotation-track> keyboard controls', () => {
  let track: DawAnnotationTrackElement;

  beforeEach(async () => {
    track = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track.keyboardControls = true;
    track.innerHTML =
      '<daw-annotation id="a" start="0" end="2">A</daw-annotation>' +
      '<daw-annotation id="b" start="2" end="4">B</daw-annotation>';
    document.body.appendChild(track);
    await flush();
  });

  afterEach(() => {
    track.remove();
  });

  it('ArrowDown with no selection selects the first annotation', () => {
    document.body.dispatchEvent(key('ArrowDown'));
    expect(track.activeAnnotationId).toBe('a');
  });

  it('navigation and consumption: matched keys stopPropagation before bubble listeners', () => {
    track.activeAnnotationId = 'a';
    const bubbleSpy = vi.fn();
    document.addEventListener('keydown', bubbleSpy); // bubble phase, like <daw-keyboard-shortcuts>
    document.body.dispatchEvent(key('ArrowDown'));
    expect(track.activeAnnotationId).toBe('b');
    expect(bubbleSpy).not.toHaveBeenCalled(); // consumed in capture phase
    document.removeEventListener('keydown', bubbleSpy);
  });

  it('Escape with a selection clears it and is consumed', () => {
    track.activeAnnotationId = 'a';
    const bubbleSpy = vi.fn();
    document.addEventListener('keydown', bubbleSpy);
    document.body.dispatchEvent(key('Escape'));
    expect(track.activeAnnotationId).toBeNull();
    expect(bubbleSpy).not.toHaveBeenCalled();
    document.removeEventListener('keydown', bubbleSpy);
  });

  it('Escape with NO selection falls through (two-press rule)', () => {
    const bubbleSpy = vi.fn();
    document.addEventListener('keydown', bubbleSpy);
    document.body.dispatchEvent(key('Escape'));
    expect(bubbleSpy).toHaveBeenCalled(); // NOT consumed
    document.removeEventListener('keydown', bubbleSpy);
  });

  it('boundary keys require editable (not consumed without it)', () => {
    track.activeAnnotationId = 'b';
    const bubbleSpy = vi.fn();
    document.addEventListener('keydown', bubbleSpy);
    document.body.dispatchEvent(key(']'));
    expect(track.annotations[1].start).toBe(2);
    expect(bubbleSpy).toHaveBeenCalled();
    document.removeEventListener('keydown', bubbleSpy);
  });

  it('boundary keys nudge ±10ms when editable', () => {
    track.editable = true;
    track.activeAnnotationId = 'b';
    document.body.dispatchEvent(key(']'));
    expect(track.annotations[1].start).toBeCloseTo(2.01);
    document.body.dispatchEvent(key('['));
    expect(track.annotations[1].start).toBeCloseTo(2.0);
  });

  it('Enter plays the active annotation', () => {
    const editor = document.createElement('daw-editor');
    document.body.appendChild(editor);
    editor.appendChild(track);
    const play = vi.fn();
    (editor as unknown as { play: unknown }).play = play;
    track.activeAnnotationId = 'a';
    document.body.dispatchEvent(key('Enter'));
    expect(play).toHaveBeenCalledWith(0, 2);
    editor.remove();
  });

  it('ignores key repeat and contentEditable targets', () => {
    document.body.dispatchEvent(key('ArrowDown', { repeat: true }));
    expect(track.activeAnnotationId).toBeNull();
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { get: () => true });
    document.body.appendChild(editable);
    editable.dispatchEvent(key('ArrowDown'));
    expect(track.activeAnnotationId).toBeNull();
    editable.remove();
  });

  it('does nothing when keyboard-controls is off', () => {
    track.keyboardControls = false;
    document.body.dispatchEvent(key('ArrowDown'));
    expect(track.activeAnnotationId).toBeNull();
  });

  it('remapping via annotationShortcuts replaces defaults for that action only', () => {
    track.annotationShortcuts = { selectNext: { key: 'j' } };
    document.body.dispatchEvent(key('ArrowDown')); // no longer bound
    expect(track.activeAnnotationId).toBeNull();
    document.body.dispatchEvent(key('j'));
    expect(track.activeAnnotationId).toBe('a');
    document.body.dispatchEvent(key('ArrowUp')); // selectPrevious untouched
    expect(track.activeAnnotationId).toBe('b'); // wrapped backward from 'a'
    track.annotationShortcuts = null; // reset to defaults
    document.body.dispatchEvent(key('ArrowDown'));
    expect(track.activeAnnotationId).toBe('a');
  });

  it('a throwing shortcut action is caught, warned, and reported via daw-error', () => {
    track.activeAnnotationId = 'a';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.fn();
    document.addEventListener('daw-error', errorSpy);
    track.selectNext = () => {
      throw new Error('boom');
    };
    expect(() => document.body.dispatchEvent(key('ArrowDown'))).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain('Annotation shortcut failed');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const detail = (errorSpy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.operation).toBe('annotation-shortcut');
    expect(detail.key).toBe('ArrowDown');
    expect(detail.error).toBeInstanceOf(Error);
    document.removeEventListener('daw-error', errorSpy);
    warnSpy.mockRestore();
  });

  it('multi-track determinism: a consumed key acts on exactly the first-registered track', async () => {
    const track2 = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track2.keyboardControls = true;
    track2.innerHTML =
      '<daw-annotation id="c" start="0" end="2">C</daw-annotation>' +
      '<daw-annotation id="d" start="2" end="4">D</daw-annotation>';
    document.body.appendChild(track2);
    await flush();

    document.body.dispatchEvent(key('ArrowDown'));

    expect(track.activeAnnotationId).toBe('a');
    expect(track2.activeAnnotationId).toBeNull();

    track2.remove();
  });
});
