// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  handleKeyboardEvent,
  getShortcutLabel,
  matchesKeyBinding,
  observeFocusSource,
  keyBelongsToFocusedControl,
} from '../keyboard';
import type { KeyboardShortcut } from '../keyboard';

function makeKeyboardEvent(
  key: string,
  overrides: Partial<KeyboardEventInit & { repeat: boolean }> = {}
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ...overrides,
  });
  Object.defineProperty(event, 'target', { value: document.body });
  return event;
}

describe('handleKeyboardEvent', () => {
  let action: Mock<() => void>;
  let shortcuts: KeyboardShortcut[];

  beforeEach(() => {
    action = vi.fn();
    shortcuts = [{ key: ' ', action, description: 'Play/Pause', preventDefault: true }];
  });

  it('calls action on matching keydown', () => {
    handleKeyboardEvent(makeKeyboardEvent(' '), shortcuts, true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not call action when disabled', () => {
    handleKeyboardEvent(makeKeyboardEvent(' '), shortcuts, false);
    expect(action).not.toHaveBeenCalled();
  });

  it('does not call action on key repeat', () => {
    handleKeyboardEvent(makeKeyboardEvent(' ', { repeat: true }), shortcuts, true);
    expect(action).not.toHaveBeenCalled();
  });

  it('does not call action for non-matching key', () => {
    handleKeyboardEvent(makeKeyboardEvent('a'), shortcuts, true);
    expect(action).not.toHaveBeenCalled();
  });

  it('matches keys case-insensitively', () => {
    const sAction = vi.fn();
    const sShortcuts: KeyboardShortcut[] = [{ key: 's', action: sAction, description: 'Split' }];
    handleKeyboardEvent(makeKeyboardEvent('S'), sShortcuts, true);
    expect(sAction).toHaveBeenCalledTimes(1);
  });

  it('does not call action when target is an input element', () => {
    const input = document.createElement('input');
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    Object.defineProperty(event, 'target', { value: input });
    handleKeyboardEvent(event, shortcuts, true);
    expect(action).not.toHaveBeenCalled();
  });

  it('does not call action when target is a textarea element', () => {
    const textarea = document.createElement('textarea');
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    Object.defineProperty(event, 'target', { value: textarea });
    handleKeyboardEvent(event, shortcuts, true);
    expect(action).not.toHaveBeenCalled();
  });

  it('does not call action when target is contentEditable', () => {
    const div = document.createElement('div');
    Object.defineProperty(div, 'isContentEditable', { value: true });
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    Object.defineProperty(event, 'target', { value: div });
    handleKeyboardEvent(event, shortcuts, true);
    expect(action).not.toHaveBeenCalled();
  });

  describe('keys that belong to the focused control (#710)', () => {
    let escape: Mock<() => void>;
    let zero: Mock<() => void>;
    let all: KeyboardShortcut[];

    beforeEach(() => {
      escape = vi.fn();
      zero = vi.fn();
      all = [
        { key: ' ', action },
        { key: 'Escape', action: escape },
        { key: '0', action: zero },
      ];
    });

    /** A keydown whose target is `el`; `path` simulates what composedPath() reports. */
    function keydownOn(el: Element, key: string, path?: EventTarget[]) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      Object.defineProperty(event, 'target', { value: path ? path[path.length - 1] : el });
      if (path) Object.defineProperty(event, 'composedPath', { value: () => path });
      return event;
    }

    /** Makes `el.matches(selector)` answer for the pseudo-classes the handler asks about. */
    function withPseudo(el: Element, answers: Record<string, boolean>) {
      const original = el.matches.bind(el);
      el.matches = (selector: string) =>
        selector in answers ? answers[selector] : original(selector);
      return el;
    }

    it('leaves every key to a <select>', () => {
      const select = document.createElement('select');
      for (const key of [' ', 'Escape', '0']) {
        const event = keydownOn(select, key);
        handleKeyboardEvent(event, all, true);
        expect(event.defaultPrevented).toBe(false);
      }
      expect(action).not.toHaveBeenCalled();
      expect(escape).not.toHaveBeenCalled();
      expect(zero).not.toHaveBeenCalled();
    });

    it('leaves Escape to an open modal dialog, wherever focus is inside it', () => {
      const dialog = withPseudo(document.createElement('dialog'), { ':modal': true });
      dialog.setAttribute('open', '');
      const inner = document.createElement('div');
      dialog.appendChild(inner);
      document.body.appendChild(dialog);

      const event = keydownOn(inner, 'Escape');
      handleKeyboardEvent(event, all, true);
      expect(escape).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);

      // Other shortcuts still work with focus inside the dialog.
      handleKeyboardEvent(keydownOn(inner, '0'), all, true);
      expect(zero).toHaveBeenCalledTimes(1);
      dialog.remove();
    });

    it('leaves Escape to an open modal dialog when focus is outside it', () => {
      // Clicking the dialog's padding can leave focus on <body>.
      const dialog = withPseudo(document.createElement('dialog'), { ':modal': true });
      dialog.setAttribute('open', '');
      document.body.appendChild(dialog);

      const event = keydownOn(document.body, 'Escape');
      handleKeyboardEvent(event, all, true);
      expect(escape).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
      expect(keyBelongsToFocusedControl(event)).toBe(true);

      // Only Escape: other shortcuts are unaffected, and so is Escape once it closes.
      handleKeyboardEvent(keydownOn(document.body, '0'), all, true);
      expect(zero).toHaveBeenCalledTimes(1);
      dialog.remove();
      handleKeyboardEvent(keydownOn(document.body, 'Escape'), all, true);
      expect(escape).toHaveBeenCalledTimes(1);
    });

    it('leaves Escape to an aria-modal container', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      const inner = document.createElement('div');
      modal.appendChild(inner);
      document.body.appendChild(modal);
      handleKeyboardEvent(keydownOn(inner, 'Escape'), all, true);
      expect(escape).not.toHaveBeenCalled();
      modal.remove();
    });

    it('still handles Escape in a non-modal or closed dialog', () => {
      const nonModal = withPseudo(document.createElement('dialog'), { ':modal': false });
      nonModal.setAttribute('open', '');
      document.body.appendChild(nonModal);
      handleKeyboardEvent(keydownOn(nonModal, 'Escape'), all, true);
      expect(escape).toHaveBeenCalledTimes(1);

      const closed = withPseudo(document.createElement('dialog'), { ':modal': true });
      document.body.appendChild(closed);
      handleKeyboardEvent(keydownOn(closed, 'Escape'), all, true);
      expect(escape).toHaveBeenCalledTimes(2);
      nonModal.remove();
      closed.remove();
    });

    describe('buttons and links', () => {
      let stopObserving: () => void;
      let host: HTMLElement;

      beforeEach(() => {
        stopObserving = observeFocusSource(document);
        host = document.createElement('div');
        document.body.appendChild(host);
      });

      afterEach(() => {
        stopObserving();
        host.remove();
      });

      /** The events a real click produces, up to the focus change. */
      function focusWithPointer(el: HTMLElement, pressedOn: Element = el) {
        pressedOn.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
        el.dispatchEvent(new Event('focusin', { bubbles: true, composed: true }));
      }

      /** Tab onto the element: a keydown, then the focus change. */
      function focusWithKeyboard(el: HTMLElement) {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        el.dispatchEvent(new Event('focusin', { bubbles: true, composed: true }));
      }

      function make(kind: string): HTMLElement {
        const el = document.createElement(kind === 'role' ? 'div' : kind);
        if (kind === 'a') el.setAttribute('href', '#x');
        if (kind === 'role') el.setAttribute('role', 'button');
        host.appendChild(el);
        return el;
      }

      describe.each(['button', 'summary', 'a'])('%s', (kind) => {
        it('keeps Space and Enter when it was focused from the keyboard', () => {
          const el = make(kind);
          focusWithKeyboard(el);
          const enter = vi.fn();
          const withEnter = [...all, { key: 'Enter', action: enter }];
          for (const key of [' ', 'Enter']) {
            const event = keydownOn(el, key);
            handleKeyboardEvent(event, withEnter, true);
            expect(event.defaultPrevented).toBe(false);
          }
          expect(action).not.toHaveBeenCalled();
          expect(enter).not.toHaveBeenCalled();
        });

        it('gives Space to the shortcut when it was focused with the pointer', () => {
          const el = make(kind);
          focusWithPointer(el);
          const event = keydownOn(el, ' ');
          handleKeyboardEvent(event, all, true);
          expect(action).toHaveBeenCalledTimes(1);
          expect(event.defaultPrevented).toBe(true);
          // and again: the element is still the pointer-focused one
          handleKeyboardEvent(keydownOn(el, ' '), all, true);
          expect(action).toHaveBeenCalledTimes(2);
        });

        it('keeps Enter even when it was focused with the pointer', () => {
          const el = make(kind);
          focusWithPointer(el);
          const enter = vi.fn();
          const event = keydownOn(el, 'Enter');
          handleKeyboardEvent(event, [...all, { key: 'Enter', action: enter }], true);
          expect(enter).not.toHaveBeenCalled();
          expect(event.defaultPrevented).toBe(false);
        });

        it('does not keep other keys', () => {
          const el = make(kind);
          focusWithKeyboard(el);
          handleKeyboardEvent(keydownOn(el, '0'), all, true);
          handleKeyboardEvent(keydownOn(el, 'Escape'), all, true);
          expect(zero).toHaveBeenCalledTimes(1);
          expect(escape).toHaveBeenCalledTimes(1);
        });
      });

      it('does not yield to an ARIA-role widget: only its own script knows its keys', () => {
        // e.g. a dnd-kit drag handle: role="button", focusable, pointer-only.
        const handle = make('role');
        focusWithKeyboard(handle);
        handleKeyboardEvent(keydownOn(handle, ' '), all, true);
        expect(action).toHaveBeenCalledTimes(1);
      });

      it('gives Space back to the shortcut once the pointer is used elsewhere', () => {
        // Tab to Mute, then drag a clip: that pointerdown is cancelled, so focus
        // never leaves the button.
        const button = make('button');
        const elsewhere = make('div');
        focusWithKeyboard(button);
        elsewhere.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
        handleKeyboardEvent(keydownOn(button, ' '), all, true);
        expect(action).toHaveBeenCalledTimes(1);
      });

      describe.each(['range', 'checkbox'])('<input type="%s">', (type) => {
        function makeInput() {
          const input = document.createElement('input');
          input.setAttribute('type', type);
          host.appendChild(input);
          return input;
        }

        it('keeps every key while operated from the keyboard', () => {
          const input = makeInput();
          focusWithKeyboard(input);
          for (const key of [' ', '0', 'Escape']) {
            handleKeyboardEvent(keydownOn(input, key), all, true);
          }
          expect(action).not.toHaveBeenCalled();
          expect(zero).not.toHaveBeenCalled();
          expect(escape).not.toHaveBeenCalled();
        });

        it('after a click or drag, Space is a shortcut again but other keys are not', () => {
          const input = makeInput();
          focusWithPointer(input);
          handleKeyboardEvent(keydownOn(input, ' '), all, true);
          expect(action).toHaveBeenCalledTimes(1);
          handleKeyboardEvent(keydownOn(input, '0'), all, true);
          expect(zero).not.toHaveBeenCalled();
          const enter = vi.fn();
          handleKeyboardEvent(keydownOn(input, 'Enter'), [{ key: 'Enter', action: enter }], true);
          expect(enter).not.toHaveBeenCalled();
        });
      });

      it.each(['pointer', 'keyboard'])(
        'a <select> keeps every key, whether it was focused by %s',
        (source) => {
          // A focused dropdown behaves as it does everywhere else: Space opens it.
          const select = document.createElement('select');
          host.appendChild(select);
          if (source === 'pointer') focusWithPointer(select);
          else focusWithKeyboard(select);
          const enter = vi.fn();
          const withEnter = [...all, { key: 'Enter', action: enter }];
          for (const key of [' ', 'Enter', 'Escape', '0']) {
            const event = keydownOn(select, key);
            handleKeyboardEvent(event, withEnter, true);
            expect(event.defaultPrevented).toBe(false);
          }
          expect(action).not.toHaveBeenCalled();
          expect(enter).not.toHaveBeenCalled();
          expect(escape).not.toHaveBeenCalled();
          expect(zero).not.toHaveBeenCalled();
        }
      );

      it('a clicked text input still keeps every key', () => {
        const input = document.createElement('input');
        host.appendChild(input);
        focusWithPointer(input);
        handleKeyboardEvent(keydownOn(input, ' '), all, true);
        expect(action).not.toHaveBeenCalled();
      });

      it('counts a press on a child of the button as pointer focus', () => {
        const button = make('button');
        const icon = document.createElement('span');
        button.appendChild(icon);
        focusWithPointer(button, icon);
        handleKeyboardEvent(keydownOn(button, ' '), all, true);
        expect(action).toHaveBeenCalledTimes(1);
      });

      it('treats focus moved by script after a click elsewhere as keyboard focus', () => {
        // Click "open menu"; the menu then focuses its first item.
        const opener = make('button');
        const item = make('button');
        opener.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
        item.dispatchEvent(new Event('focusin', { bubbles: true, composed: true }));
        handleKeyboardEvent(keydownOn(item, ' '), all, true);
        expect(action).not.toHaveBeenCalled();
      });

      it('a pointer-focused button reached again with Tab keeps its keys', () => {
        const button = make('button');
        const other = make('button');
        focusWithPointer(button);
        focusWithKeyboard(other);
        focusWithKeyboard(button);
        handleKeyboardEvent(keydownOn(button, ' '), all, true);
        expect(action).not.toHaveBeenCalled();
      });

      it('treats a link without href as plain content', () => {
        const a = document.createElement('a');
        host.appendChild(a);
        focusWithKeyboard(a);
        handleKeyboardEvent(keydownOn(a, ' '), all, true);
        expect(action).toHaveBeenCalledTimes(1);
      });

      it('sees through shadow DOM: the inner button is the focused element', () => {
        const shadowHost = document.createElement('div');
        host.appendChild(shadowHost);
        const root = shadowHost.attachShadow({ mode: 'open' });
        const inner = document.createElement('button');
        root.appendChild(inner);

        focusWithKeyboard(inner);
        handleKeyboardEvent(
          keydownOn(inner, ' ', [inner, root, shadowHost, document.body]),
          all,
          true
        );
        expect(action).not.toHaveBeenCalled();

        focusWithPointer(inner);
        handleKeyboardEvent(
          keydownOn(inner, ' ', [inner, root, shadowHost, document.body]),
          all,
          true
        );
        expect(action).toHaveBeenCalledTimes(1);
      });
    });

    describe('observeFocusSource', () => {
      it('without it, a clicked button still keeps Space (the accessible default)', () => {
        const button = document.createElement('button');
        document.body.appendChild(button);
        button.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
        button.dispatchEvent(new Event('focusin', { bubbles: true, composed: true }));
        handleKeyboardEvent(keydownOn(button, ' '), all, true);
        expect(action).not.toHaveBeenCalled();
        button.remove();
      });

      it('is reference counted per document and forgets its state when the last stops', () => {
        const add = vi.spyOn(document, 'addEventListener');
        const remove = vi.spyOn(document, 'removeEventListener');
        const stopA = observeFocusSource(document);
        const stopB = observeFocusSource(document);
        expect(add).toHaveBeenCalledTimes(3);

        const button = document.createElement('button');
        document.body.appendChild(button);
        button.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
        button.dispatchEvent(new Event('focusin', { bubbles: true, composed: true }));

        stopA();
        stopA(); // idempotent
        expect(remove).not.toHaveBeenCalled();
        handleKeyboardEvent(keydownOn(button, ' '), all, true);
        expect(action).toHaveBeenCalledTimes(1);

        stopB();
        expect(remove).toHaveBeenCalledTimes(3);
        handleKeyboardEvent(keydownOn(button, ' '), all, true);
        expect(action).toHaveBeenCalledTimes(1); // state forgotten: the button keeps Space
        button.remove();
        add.mockRestore();
        remove.mockRestore();
      });
    });

    it('looks through shadow DOM: the real target is the first entry of composedPath()', () => {
      // At a document listener, event.target is retargeted to the shadow host.
      const host = document.createElement('div');
      document.body.appendChild(host);

      const input = document.createElement('input');
      handleKeyboardEvent(keydownOn(input, ' ', [input, host, document.body]), all, true);
      expect(action).not.toHaveBeenCalled();

      // A modal dialog further up the composed path still owns Escape.
      const dialog = withPseudo(document.createElement('dialog'), { ':modal': true });
      dialog.setAttribute('open', '');
      const span = document.createElement('span');
      handleKeyboardEvent(
        keydownOn(span, 'Escape', [span, host, dialog, document.body]),
        all,
        true
      );
      expect(escape).not.toHaveBeenCalled();
      host.remove();
    });
  });

  it('calls preventDefault when shortcut.preventDefault is true', () => {
    const event = makeKeyboardEvent(' ');
    const spy = vi.spyOn(event, 'preventDefault');
    handleKeyboardEvent(event, shortcuts, true);
    expect(spy).toHaveBeenCalled();
  });

  it('does not call preventDefault when shortcut.preventDefault is false', () => {
    const noPrevent: KeyboardShortcut[] = [
      { key: ' ', action, description: 'test', preventDefault: false },
    ];
    const event = makeKeyboardEvent(' ');
    const spy = vi.spyOn(event, 'preventDefault');
    handleKeyboardEvent(event, noPrevent, true);
    expect(spy).not.toHaveBeenCalled();
  });

  describe('modifier key matching', () => {
    it('matches ctrlKey when specified', () => {
      const ctrlShortcuts: KeyboardShortcut[] = [
        { key: 'z', action, ctrlKey: true, description: 'Undo' },
      ];
      handleKeyboardEvent(makeKeyboardEvent('z', { ctrlKey: true }), ctrlShortcuts, true);
      expect(action).toHaveBeenCalledTimes(1);

      handleKeyboardEvent(makeKeyboardEvent('z', { ctrlKey: false }), ctrlShortcuts, true);
      expect(action).toHaveBeenCalledTimes(1); // Still 1 — not called again
    });

    it('matches shiftKey when specified', () => {
      const shiftShortcuts: KeyboardShortcut[] = [
        { key: 's', action, shiftKey: true, description: 'Split at selection' },
      ];
      handleKeyboardEvent(makeKeyboardEvent('S', { shiftKey: true }), shiftShortcuts, true);
      expect(action).toHaveBeenCalledTimes(1);

      handleKeyboardEvent(makeKeyboardEvent('s', { shiftKey: false }), shiftShortcuts, true);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('ignores modifier keys when not specified in shortcut', () => {
      handleKeyboardEvent(makeKeyboardEvent(' ', { ctrlKey: true }), shortcuts, true);
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple shortcuts', () => {
    it('calls the correct action for each key', () => {
      const playAction = vi.fn();
      const stopAction = vi.fn();
      const multi: KeyboardShortcut[] = [
        { key: ' ', action: playAction, description: 'Play' },
        { key: 'Escape', action: stopAction, description: 'Stop' },
      ];

      handleKeyboardEvent(makeKeyboardEvent(' '), multi, true);
      expect(playAction).toHaveBeenCalledTimes(1);
      expect(stopAction).not.toHaveBeenCalled();

      handleKeyboardEvent(makeKeyboardEvent('Escape'), multi, true);
      expect(stopAction).toHaveBeenCalledTimes(1);
    });
  });
});

describe('getShortcutLabel', () => {
  it('returns uppercase key for simple shortcut', () => {
    expect(getShortcutLabel({ key: 's', action: () => {} })).toBe('S');
  });

  it('includes Ctrl for ctrlKey shortcut', () => {
    expect(getShortcutLabel({ key: 'z', ctrlKey: true, action: () => {} })).toBe('Ctrl+Z');
  });

  it('includes Shift for shiftKey shortcut', () => {
    expect(getShortcutLabel({ key: 's', shiftKey: true, action: () => {} })).toBe('Shift+S');
  });

  it('combines multiple modifiers', () => {
    const label = getShortcutLabel({
      key: 's',
      ctrlKey: true,
      shiftKey: true,
      action: () => {},
    });
    expect(label).toBe('Ctrl+Shift+S');
  });
});

describe('matchesKeyBinding', () => {
  const ev = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

  it('matches key case-insensitively', () => {
    expect(matchesKeyBinding(ev({ key: 'S' }), { key: 's' })).toBe(true);
  });

  it('undefined modifier matches any state', () => {
    expect(matchesKeyBinding(ev({ key: 'a', ctrlKey: true }), { key: 'a' })).toBe(true);
  });

  it('explicit false modifier must NOT be pressed', () => {
    expect(matchesKeyBinding(ev({ key: 'a', ctrlKey: true }), { key: 'a', ctrlKey: false })).toBe(
      false
    );
  });

  it('explicit true modifier must be pressed', () => {
    expect(matchesKeyBinding(ev({ key: 'z', shiftKey: true }), { key: 'z', shiftKey: true })).toBe(
      true
    );
    expect(matchesKeyBinding(ev({ key: 'z' }), { key: 'z', shiftKey: true })).toBe(false);
  });
});
