import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../elements/daw-annotation';
import '../elements/daw-annotation-track';
import type { DawAnnotationTrackElement } from '../elements/daw-annotation-track';

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeTrack(): DawAnnotationTrackElement {
  const track = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
  track.innerHTML = `
    <daw-annotation id="a" start="0" end="2">First</daw-annotation>
    <daw-annotation id="b" start="2" end="4">Second</daw-annotation>
    <daw-annotation id="c" start="4" end="6">Third</daw-annotation>
  `;
  document.body.appendChild(track);
  return track;
}

describe('<daw-annotation-track>', () => {
  let track: DawAnnotationTrackElement;

  beforeEach(async () => {
    track = makeTrack();
    await flush();
  });

  afterEach(() => {
    track.remove();
  });

  it('exposes children as sorted AnnotationData', () => {
    expect(track.annotations.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('hides itself and its <daw-annotation> children on connect so light-DOM text does not leak through a host <slot>', () => {
    expect(track.style.display).toBe('none');
    track.annotationElements.forEach((el) => {
      expect(el.style.display).toBe('none');
    });
  });

  it('boolean attributes map to properties', () => {
    track.setAttribute('editable', '');
    track.setAttribute('link-endpoints', '');
    expect(track.editable).toBe(true);
    expect(track.linkEndpoints).toBe(true);
    expect(track.continuousPlay).toBe(false);
  });

  it('selectNext wraps and starts from first with no selection', () => {
    track.selectNext();
    expect(track.activeAnnotationId).toBe('a');
    track.selectNext();
    expect(track.activeAnnotationId).toBe('b');
    track.activeAnnotationId = 'c';
    track.selectNext(); // wraps
    expect(track.activeAnnotationId).toBe('a');
  });

  it('selectPrevious with no selection selects last; wraps backward', () => {
    track.selectPrevious();
    expect(track.activeAnnotationId).toBe('c');
    track.selectPrevious();
    expect(track.activeAnnotationId).toBe('b');
  });

  it('selectFirst/selectLast/clearSelection', () => {
    track.selectLast();
    expect(track.activeAnnotationId).toBe('c');
    track.selectFirst();
    expect(track.activeAnnotationId).toBe('a');
    track.clearSelection();
    expect(track.activeAnnotationId).toBeNull();
  });

  it('setting an unknown activeAnnotationId warns and is ignored', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    track.activeAnnotationId = 'nope';
    expect(track.activeAnnotationId).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('dispatches daw-annotation-select on selection change (and null on clear)', () => {
    const events: Array<string | null> = [];
    track.addEventListener('daw-annotation-select', ((e: Event) => {
      events.push((e as CustomEvent).detail.annotation?.id ?? null);
    }) as EventListener);
    track.selectFirst();
    track.clearSelection();
    expect(events).toEqual(['a', null]);
  });

  it('clears selection when the active annotation element is removed', async () => {
    track.activeAnnotationId = 'b';
    track.querySelector('#b')!.remove();
    await flush();
    expect(track.activeAnnotationId).toBeNull();
  });

  it('moveStartBoundary requires editable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    track.activeAnnotationId = 'b';
    track.moveStartBoundary(100);
    expect(track.annotations[1].start).toBe(2); // unchanged
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('moveStartBoundary applies core boundary math with link-endpoints', () => {
    track.editable = true;
    track.linkEndpoints = true;
    track.activeAnnotationId = 'b';
    track.moveStartBoundary(-500); // b.start 2 → 1.5, linked a.end follows
    expect(track.annotations[1].start).toBeCloseTo(1.5);
    expect(track.annotations[0].end).toBeCloseTo(1.5);
  });

  it('moveEndBoundary moves the active end', () => {
    track.editable = true;
    track.activeAnnotationId = 'c';
    track.moveEndBoundary(250);
    expect(track.annotations[2].end).toBeCloseTo(6.25);
  });

  it('moveEndBoundary is unclamped past the natural duration when the host editor reports Infinity (indefinite-playback)', () => {
    const editor = document.createElement('daw-editor');
    document.body.appendChild(editor);
    // Shadow the accessor for this instance only — emulates
    // indefinite-playback without exercising the full editor lifecycle.
    Object.defineProperty(editor, '_annotationClampDuration', {
      value: Infinity,
      configurable: true,
    });
    editor.appendChild(track);
    track.editable = true;
    track.activeAnnotationId = 'c'; // last annotation, end=6
    track.moveEndBoundary(100000); // +100s
    expect(track.annotations[2].end).toBeCloseTo(106);
    editor.remove();
  });

  it('playActive with continuous-play off plays the annotation range on the host editor', () => {
    const editor = document.createElement('daw-editor');
    document.body.appendChild(editor);
    editor.appendChild(track);
    const play = vi.fn();
    (editor as unknown as { play: unknown }).play = play;
    track.activeAnnotationId = 'b';
    track.playActive();
    expect(play).toHaveBeenCalledWith(2, 4);
    track.continuousPlay = true;
    track.playActive();
    expect(play).toHaveBeenCalledWith(2, undefined);
    editor.remove();
  });

  it('playActive without a host editor warns and no-ops', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    track.activeAnnotationId = 'a';
    track.playActive();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('dispatches deferred daw-annotation-track-connected', async () => {
    const spy = vi.fn();
    document.body.addEventListener('daw-annotation-track-connected', spy, { once: true });
    const t2 = document.createElement('daw-annotation-track');
    document.body.appendChild(t2);
    await flush();
    expect(spy).toHaveBeenCalled();
    t2.remove();
  });
});
