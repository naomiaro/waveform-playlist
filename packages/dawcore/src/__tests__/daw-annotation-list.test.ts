import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../elements/daw-annotation';
import '../elements/daw-annotation-track';
import '../elements/daw-annotation-list';
import type { DawAnnotationTrackElement } from '../elements/daw-annotation-track';
import type { DawAnnotationListElement } from '../elements/daw-annotation-list';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('<daw-annotation-list>', () => {
  let track: DawAnnotationTrackElement;
  let list: DawAnnotationListElement;

  beforeEach(async () => {
    track = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track.id = 'lyrics';
    track.innerHTML =
      '<daw-annotation id="a" start="0" end="2.5">First line</daw-annotation>' +
      '<daw-annotation id="b" start="2.5" end="5">Second line</daw-annotation>';
    document.body.appendChild(track);
    list = document.createElement('daw-annotation-list') as DawAnnotationListElement;
    list.setAttribute('for', 'lyrics');
    document.body.appendChild(list);
    await flush();
    await list.updateComplete;
  });

  afterEach(() => {
    track.remove();
    list.remove();
  });

  it('renders one row per annotation with text and times', () => {
    const rows = list.shadowRoot!.querySelectorAll('.annotation-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('First line');
    expect(rows[0].textContent).toContain('0:00');
  });

  it('re-renders when an annotation attribute changes (dual-view sync)', async () => {
    const el = track.querySelector('#b') as HTMLElement & { end: number };
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    el.end = 9;
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    await flush();
    await list.updateComplete;
    const rows = list.shadowRoot!.querySelectorAll('.annotation-row');
    expect(rows[1].textContent).toContain('0:09');
  });

  it('re-renders when an annotation is added or removed', async () => {
    track.insertAdjacentHTML(
      'beforeend',
      '<daw-annotation id="c" start="5" end="7">Third</daw-annotation>'
    );
    await flush();
    await list.updateComplete;
    expect(list.shadowRoot!.querySelectorAll('.annotation-row')).toHaveLength(3);
    track.querySelector('#c')!.remove();
    await flush();
    await list.updateComplete;
    expect(list.shadowRoot!.querySelectorAll('.annotation-row')).toHaveLength(2);
  });

  it('clicking a row selects it and seeks the host editor', async () => {
    const editor = document.createElement('daw-editor');
    document.body.appendChild(editor);
    editor.appendChild(track);
    const seekTo = vi.fn();
    (editor as unknown as { seekTo: unknown }).seekTo = seekTo;
    await flush();
    await list.updateComplete;
    const row = list.shadowRoot!.querySelectorAll('.annotation-row')[1] as HTMLElement;
    row.click();
    expect(track.activeAnnotationId).toBe('b');
    expect(seekTo).toHaveBeenCalledWith(2.5);
    editor.remove();
  });

  it('clicking directly on an editable row text still selects and seeks (real-browser focus-before-click order)', async () => {
    // Real browsers dispatch `focus` on the contenteditable text span BEFORE
    // the `click` event bubbles to the row — `row.click()` (used by the test
    // above) skips that native sequence entirely. Reproduce it explicitly:
    // a naive "skip while _editingId===a.id" guard would treat this focus as
    // proof editing was already underway and swallow the click, silently
    // breaking select+seek for the very first click into a row's text.
    track.editable = true;
    await track.updateComplete;
    await flush();
    await list.updateComplete;

    const editor = document.createElement('daw-editor');
    document.body.appendChild(editor);
    editor.appendChild(track);
    const seekTo = vi.fn();
    (editor as unknown as { seekTo: unknown }).seekTo = seekTo;
    await flush();
    await list.updateComplete;

    const row = list.shadowRoot!.querySelectorAll('.annotation-row')[1] as HTMLElement;
    const span = row.querySelector('.annotation-row-text') as HTMLElement;
    span.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    row.click();

    expect(track.activeAnnotationId).toBe('b');
    expect(seekTo).toHaveBeenCalledWith(2.5);
    editor.remove();
  });

  it('highlights the active row on daw-annotation-select', async () => {
    track.activeAnnotationId = 'a';
    await list.updateComplete;
    const rows = list.shadowRoot!.querySelectorAll('.annotation-row');
    expect(rows[0].classList.contains('active')).toBe(true);
    expect(rows[1].classList.contains('active')).toBe(false);
  });

  it('text is contenteditable only when the track is editable', async () => {
    let span = list.shadowRoot!.querySelector('.annotation-row-text') as HTMLElement;
    expect(span.getAttribute('contenteditable')).toBeNull();
    track.editable = true;
    await track.updateComplete;
    await flush();
    await list.updateComplete;
    span = list.shadowRoot!.querySelector('.annotation-row-text') as HTMLElement;
    expect(span.getAttribute('contenteditable')).toBe('true');
  });

  it('committing a text edit writes back to the daw-annotation textContent', async () => {
    track.editable = true;
    await track.updateComplete;
    await flush();
    await list.updateComplete;
    const span = list.shadowRoot!.querySelector('.annotation-row-text') as HTMLElement;
    span.textContent = 'Edited line';
    span.dispatchEvent(new FocusEvent('blur'));
    expect(track.querySelector('#a')!.textContent).toBe('Edited line');
  });

  it('renders empty and warns on unresolvable for target', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const orphan = document.createElement('daw-annotation-list') as DawAnnotationListElement;
    orphan.setAttribute('for', 'missing');
    document.body.appendChild(orphan);
    await flush();
    await orphan.updateComplete;
    expect(orphan.shadowRoot!.querySelectorAll('.annotation-row')).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    orphan.remove();
    warn.mockRestore();
  });

  it('cancelling an edit with Escape restores the original text and does not commit on the resulting blur', async () => {
    track.editable = true;
    await track.updateComplete;
    await flush();
    await list.updateComplete;
    const span = list.shadowRoot!.querySelector('.annotation-row-text') as HTMLElement;
    span.dispatchEvent(new FocusEvent('focus'));
    span.textContent = 'draft text';
    span.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(span.textContent).toBe('First line');
    expect(track.querySelector('#a')!.textContent).toBe('First line');
    // A subsequent blur (e.g. focus moving elsewhere) must not commit 'draft text'.
    span.dispatchEvent(new FocusEvent('blur'));
    expect(track.querySelector('#a')!.textContent).toBe('First line');
  });

  it('empty-text rows keep a selectable presence (placeholder styling hook)', async () => {
    track.insertAdjacentHTML(
      'beforeend',
      '<daw-annotation id="blank" start="5" end="6"></daw-annotation>'
    );
    await flush();
    await list.updateComplete;
    const rows = list.shadowRoot!.querySelectorAll('.annotation-row');
    expect(rows).toHaveLength(3);
    const span = rows[2].querySelector('.annotation-row-text') as HTMLElement;
    expect(span.textContent).toBe(''); // :empty — the CSS ::before placeholder applies
    // Structural assertion for the placeholder rule (happy-dom doesn't compute
    // pseudo-elements — assert the stylesheet carries it).
    const cssText = String((list.constructor as typeof DawAnnotationListElement).styles);
    expect(cssText).toContain(':empty::before');
  });

  describe('playing highlight (daw-timeupdate)', () => {
    // Filtered by e.target === this.track?.closest('daw-editor') — the
    // track must be reparented under a stub editor and events dispatched
    // FROM that editor (bubbles: true), mirroring the daw-annotation-select
    // pattern used by the tests above.
    let editor: HTMLElement;

    beforeEach(async () => {
      editor = document.createElement('daw-editor');
      document.body.appendChild(editor);
      editor.appendChild(track);
      await flush();
      await list.updateComplete;
    });

    afterEach(() => {
      editor.remove();
    });

    function dispatchTimeUpdate(time: number) {
      editor.dispatchEvent(
        new CustomEvent('daw-timeupdate', { detail: { time }, bubbles: true, composed: true })
      );
    }

    function dispatchStop() {
      editor.dispatchEvent(new CustomEvent('daw-stop', { bubbles: true, composed: true }));
    }

    it('highlights the row for the annotation the playhead is inside', async () => {
      dispatchTimeUpdate(3.5); // inside annotation b (2.5-5)
      await list.updateComplete;
      const rows = list.shadowRoot!.querySelectorAll('.annotation-row');
      expect(rows[0].classList.contains('playing')).toBe(false);
      expect(rows[1].classList.contains('playing')).toBe(true);
    });

    it('does not re-render for a second timeupdate inside the same annotation', async () => {
      dispatchTimeUpdate(3.5);
      await list.updateComplete;
      const spy = vi.spyOn(list, 'requestUpdate');
      dispatchTimeUpdate(3.6);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('shows no playing row when the playhead is in a gap', async () => {
      dispatchTimeUpdate(3.5);
      await list.updateComplete;
      dispatchTimeUpdate(6); // past both annotations (b ends at 5)
      await list.updateComplete;
      const rows = list.shadowRoot!.querySelectorAll('.annotation-row');
      expect(rows[0].classList.contains('playing')).toBe(false);
      expect(rows[1].classList.contains('playing')).toBe(false);
    });

    it('clears the playing highlight on daw-stop', async () => {
      dispatchTimeUpdate(3.5);
      await list.updateComplete;
      dispatchStop();
      await list.updateComplete;
      const rows = list.shadowRoot!.querySelectorAll('.annotation-row');
      expect(rows[1].classList.contains('playing')).toBe(false);
    });

    it('active (selection) and playing coexist on the same row', async () => {
      track.activeAnnotationId = 'b';
      await list.updateComplete;
      dispatchTimeUpdate(3.5);
      await list.updateComplete;
      const rows = list.shadowRoot!.querySelectorAll('.annotation-row');
      expect(rows[1].classList.contains('active')).toBe(true);
      expect(rows[1].classList.contains('playing')).toBe(true);
    });
  });
});
