// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { handleKeyboardEvent, type KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

function makeKeyboardEvent(
  key: string,
  overrides: Partial<KeyboardEventInit & { repeat: boolean }> = {}
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ...overrides,
  });
  // jsdom doesn't set event.target for events created directly (not dispatched).
  // Default to document.body so the target-tag check doesn't crash on null.
  Object.defineProperty(event, 'target', { value: document.body });
  return event;
}

describe('handleKeyboardEvent', () => {
  let action: Mock<() => void>;
  let shortcuts: KeyboardShortcut[];

  beforeEach(() => {
    action = vi.fn();
    shortcuts = [
      {
        key: ' ',
        action,
        description: 'Play/Pause',
        preventDefault: true,
      },
    ];
  });

  it('calls action on matching keydown', () => {
    const event = makeKeyboardEvent(' ');
    handleKeyboardEvent(event, shortcuts, true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not call action when disabled', () => {
    const event = makeKeyboardEvent(' ');
    handleKeyboardEvent(event, shortcuts, false);
    expect(action).not.toHaveBeenCalled();
  });

  it('does not call action on key repeat', () => {
    const event = makeKeyboardEvent(' ', { repeat: true });
    handleKeyboardEvent(event, shortcuts, true);
    expect(action).not.toHaveBeenCalled();
  });

  it('calls action on first keydown but not on subsequent repeats', () => {
    const first = makeKeyboardEvent(' ', { repeat: false });
    const repeat1 = makeKeyboardEvent(' ', { repeat: true });
    const repeat2 = makeKeyboardEvent(' ', { repeat: true });

    handleKeyboardEvent(first, shortcuts, true);
    handleKeyboardEvent(repeat1, shortcuts, true);
    handleKeyboardEvent(repeat2, shortcuts, true);

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not call action for non-matching key', () => {
    const event = makeKeyboardEvent('a');
    handleKeyboardEvent(event, shortcuts, true);
    expect(action).not.toHaveBeenCalled();
  });

  it('matches keys case-insensitively', () => {
    const sAction = vi.fn();
    const sShortcuts: KeyboardShortcut[] = [{ key: 's', action: sAction, description: 'Split' }];
    const event = makeKeyboardEvent('S');
    handleKeyboardEvent(event, sShortcuts, true);
    expect(sAction).toHaveBeenCalledTimes(1);
  });

  it('does not call action when target is an input element', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });

    handleKeyboardEvent(event, shortcuts, true);
    expect(action).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('does not call action when target is a textarea element', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: textarea });

    handleKeyboardEvent(event, shortcuts, true);
    expect(action).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it('does not call action when target is contentEditable', () => {
    const div = document.createElement('div');
    div.contentEditable = 'true';
    // jsdom doesn't implement isContentEditable, so we polyfill it for the test.
    Object.defineProperty(div, 'isContentEditable', { value: true });
    document.body.appendChild(div);
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: div });

    handleKeyboardEvent(event, shortcuts, true);
    expect(action).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it('calls preventDefault when shortcut.preventDefault is true', () => {
    const event = makeKeyboardEvent(' ');
    const spy = vi.spyOn(event, 'preventDefault');

    handleKeyboardEvent(event, shortcuts, true);
    expect(spy).toHaveBeenCalled();
  });

  it('does not call preventDefault when shortcut.preventDefault is false', () => {
    const noPreventShortcuts: KeyboardShortcut[] = [
      { key: ' ', action, description: 'test', preventDefault: false },
    ];
    const event = makeKeyboardEvent(' ');
    const spy = vi.spyOn(event, 'preventDefault');

    handleKeyboardEvent(event, noPreventShortcuts, true);
    expect(spy).not.toHaveBeenCalled();
  });

  describe('modifier key matching', () => {
    it('matches ctrlKey when specified', () => {
      const ctrlShortcuts: KeyboardShortcut[] = [
        { key: 'z', action, ctrlKey: true, description: 'Undo' },
      ];
      const withCtrl = makeKeyboardEvent('z', { ctrlKey: true });
      const withoutCtrl = makeKeyboardEvent('z', { ctrlKey: false });

      handleKeyboardEvent(withCtrl, ctrlShortcuts, true);
      expect(action).toHaveBeenCalledTimes(1);

      handleKeyboardEvent(withoutCtrl, ctrlShortcuts, true);
      expect(action).toHaveBeenCalledTimes(1); // Still 1 — not called again
    });

    it('matches shiftKey when specified', () => {
      const shiftShortcuts: KeyboardShortcut[] = [
        { key: 's', action, shiftKey: true, description: 'Split at selection' },
      ];
      const withShift = makeKeyboardEvent('S', { shiftKey: true });
      const withoutShift = makeKeyboardEvent('s', { shiftKey: false });

      handleKeyboardEvent(withShift, shiftShortcuts, true);
      expect(action).toHaveBeenCalledTimes(1);

      handleKeyboardEvent(withoutShift, shiftShortcuts, true);
      expect(action).toHaveBeenCalledTimes(1);
    });

    it('ignores modifier keys when not specified in shortcut', () => {
      // shortcut has no ctrlKey specified — should match regardless
      const event = makeKeyboardEvent(' ', { ctrlKey: true });
      handleKeyboardEvent(event, shortcuts, true);
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple shortcuts', () => {
    it('calls the correct action for each key', () => {
      const playAction = vi.fn();
      const stopAction = vi.fn();
      const multiShortcuts: KeyboardShortcut[] = [
        { key: ' ', action: playAction, description: 'Play' },
        { key: 'Escape', action: stopAction, description: 'Stop' },
      ];

      handleKeyboardEvent(makeKeyboardEvent(' '), multiShortcuts, true);
      expect(playAction).toHaveBeenCalledTimes(1);
      expect(stopAction).not.toHaveBeenCalled();

      handleKeyboardEvent(makeKeyboardEvent('Escape'), multiShortcuts, true);
      expect(playAction).toHaveBeenCalledTimes(1);
      expect(stopAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('rapid play/pause simulation (bug reproduction)', () => {
    it('only triggers once despite rapid key events with repeats', () => {
      // Simulates holding Space: one real keydown followed by repeats
      const events = [
        makeKeyboardEvent(' ', { repeat: false }), // Real press
        makeKeyboardEvent(' ', { repeat: true }), // Hold repeat
        makeKeyboardEvent(' ', { repeat: true }), // Hold repeat
        makeKeyboardEvent(' ', { repeat: true }), // Hold repeat
        makeKeyboardEvent(' ', { repeat: true }), // Hold repeat
      ];

      for (const event of events) {
        handleKeyboardEvent(event, shortcuts, true);
      }

      expect(action).toHaveBeenCalledTimes(1);
    });
  });
});
