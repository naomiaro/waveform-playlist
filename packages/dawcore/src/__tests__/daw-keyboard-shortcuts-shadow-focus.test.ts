// A shortcut must not take a key from a control inside a shadow root, such as
// the M/S buttons and sliders of <daw-track-controls>. At the `document`
// listener the event's target is retargeted to the shadow host, so the handler
// has to read the real target from the composed path. These tests dispatch
// real composed events from inside a shadow root; nothing is faked on the event.
//
// happy-dom does not retarget `event.target` across the shadow boundary (the
// document listener still sees the inner element), so this file cannot prove
// the retargeted case. `e2e/dawcore-keyboard-focus.spec.ts` does, in a browser.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-keyboard-shortcuts');
});

describe('<daw-keyboard-shortcuts> and controls inside shadow DOM', () => {
  let editor: HTMLElement;
  let shortcutsEl: HTMLElement & { customShortcuts: unknown };
  let space: ReturnType<typeof vi.fn<() => void>>;
  let letter: ReturnType<typeof vi.fn<() => void>>;
  let host: HTMLElement;
  let root: ShadowRoot;

  function keydownFrom(target: EventTarget, key: string) {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
    return event;
  }

  beforeEach(() => {
    space = vi.fn<() => void>();
    letter = vi.fn<() => void>();
    editor = document.createElement('daw-editor');
    shortcutsEl = document.createElement('daw-keyboard-shortcuts') as typeof shortcutsEl;
    shortcutsEl.customShortcuts = [
      { key: ' ', action: space },
      { key: 'x', action: letter },
    ];
    editor.appendChild(shortcutsEl);
    document.body.appendChild(editor);

    // Stand-in for <daw-track-controls>: native controls inside an open shadow root.
    host = document.createElement('div');
    root = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);
  });

  afterEach(() => {
    editor.remove();
    host.remove();
  });

  it('Space on a button inside a shadow root goes to the button', () => {
    const button = document.createElement('button');
    root.appendChild(button);
    const event = keydownFrom(button, ' ');
    expect(space).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    // Other keys are still shortcuts while a button has focus.
    keydownFrom(button, 'x');
    expect(letter).toHaveBeenCalledTimes(1);
  });

  it('every key on a slider inside a shadow root stays with the slider', () => {
    const slider = document.createElement('input');
    slider.type = 'range';
    root.appendChild(slider);
    keydownFrom(slider, ' ');
    keydownFrom(slider, 'x');
    expect(space).not.toHaveBeenCalled();
    expect(letter).not.toHaveBeenCalled();
  });

  it('keys from non-control content inside a shadow root are shortcuts', () => {
    const div = document.createElement('div');
    root.appendChild(div);
    const event = keydownFrom(div, ' ');
    expect(space).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('keys from the page itself are shortcuts', () => {
    keydownFrom(document.body, ' ');
    expect(space).toHaveBeenCalledTimes(1);
  });
});
