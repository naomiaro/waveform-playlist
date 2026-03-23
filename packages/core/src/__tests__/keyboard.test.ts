// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleKeyboardEvent, getShortcutLabel } from '../keyboard';
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
  let action: ReturnType<typeof vi.fn>;
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
