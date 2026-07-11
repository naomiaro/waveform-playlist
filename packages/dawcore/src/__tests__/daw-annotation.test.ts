import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../elements/daw-annotation';
import type { DawAnnotationElement } from '../elements/daw-annotation';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('<daw-annotation>', () => {
  let el: DawAnnotationElement;

  beforeEach(() => {
    el = document.createElement('daw-annotation') as DawAnnotationElement;
  });

  afterEach(() => {
    el.remove();
  });

  it('parses start/end attributes and text content into AnnotationData', async () => {
    el.setAttribute('start', '1.5');
    el.setAttribute('end', '3');
    el.textContent = 'First line';
    document.body.appendChild(el);
    await flush();
    expect(el.toAnnotationData()).toEqual({
      id: el.annotationId,
      start: 1.5,
      end: 3,
      lines: ['First line'],
    });
  });

  it('hides itself on connect so light-DOM text does not leak through a host <slot>', async () => {
    document.body.appendChild(el);
    await flush();
    expect(el.style.display).toBe('none');
  });

  it('uses the id attribute as annotationId when present', () => {
    el.id = 'a1';
    expect(el.annotationId).toBe('a1');
  });

  it('generates a stable annotationId when no id attribute', () => {
    const generated = el.annotationId;
    expect(generated).toBeTruthy();
    expect(el.annotationId).toBe(generated);
  });

  it('rejects invalid start values with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.appendChild(el);
    await flush();
    el.start = 5;
    el.start = -1; // rejected
    el.start = NaN; // rejected
    expect(el.start).toBe(5);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('reflects the start property to the attribute', async () => {
    document.body.appendChild(el);
    await flush();
    el.start = 2.5;
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.getAttribute('start')).toBe('2.5');
  });

  it('dispatches deferred daw-annotation-connected on mount', async () => {
    const events: string[] = [];
    document.body.addEventListener('daw-annotation-connected', () => events.push('connected'), {
      once: true,
    });
    document.body.appendChild(el);
    expect(events).toHaveLength(0); // deferred
    await flush();
    expect(events).toEqual(['connected']);
  });

  it('dispatches daw-annotation-update on property change after first render', async () => {
    document.body.appendChild(el);
    await flush();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const spy = vi.fn();
    document.body.addEventListener('daw-annotation-update', spy);
    el.end = 9;
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(spy).toHaveBeenCalled();
    document.body.removeEventListener('daw-annotation-update', spy);
  });

  it('parses start-tick/end-tick and reports isTickBased', async () => {
    el.setAttribute('start-tick', '960');
    el.setAttribute('end-tick', '1920');
    document.body.appendChild(el);
    await flush();
    expect(el.startTick).toBe(960);
    expect(el.endTick).toBe(1920);
    expect(el.isTickBased).toBe(true);
    expect(el.toAnnotationData().startTick).toBe(960);
    expect(el.toAnnotationData().endTick).toBe(1920);
  });

  it('is not tick-based without tick attributes, and omits tick fields', async () => {
    document.body.appendChild(el);
    await flush();
    expect(el.isTickBased).toBe(false);
    expect('startTick' in el.toAnnotationData()).toBe(false);
  });

  it('rejects invalid tick values with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.appendChild(el);
    await flush();
    el.startTick = 960;
    el.startTick = -5; // rejected
    el.startTick = 1.5; // rejected (non-integer)
    el.startTick = NaN; // rejected
    expect(el.startTick).toBe(960);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('warns once when exactly one tick attribute is set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.setAttribute('start-tick', '960');
    document.body.appendChild(el);
    await flush();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.isTickBased).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    // Setting the second tick clears the half-configured state; no repeat warn.
    el.endTick = 1920;
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.isTickBased).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('dispatches daw-annotation-update on tick change after first render', async () => {
    el.setAttribute('start-tick', '0');
    el.setAttribute('end-tick', '960');
    document.body.appendChild(el);
    await flush();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const spy = vi.fn();
    document.body.addEventListener('daw-annotation-update', spy);
    el.endTick = 1920;
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(spy).toHaveBeenCalled();
    document.body.removeEventListener('daw-annotation-update', spy);
  });
});
