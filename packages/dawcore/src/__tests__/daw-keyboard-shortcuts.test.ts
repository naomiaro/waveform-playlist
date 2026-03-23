import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-keyboard-shortcuts');
});

describe('DawKeyboardShortcutsElement', () => {
  let editor: HTMLElement & Record<string, unknown>;
  let shortcuts: HTMLElement & Record<string, unknown>;

  beforeEach(() => {
    editor = document.createElement('daw-editor') as any;
    shortcuts = document.createElement('daw-keyboard-shortcuts') as any;
  });

  afterEach(() => {
    if (editor.parentNode) editor.parentNode.removeChild(editor);
  });

  describe('editor resolution', () => {
    it('finds parent daw-editor via closest()', () => {
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      expect((shortcuts as any)._editor).toBe(editor);
      document.body.removeChild(editor);
    });

    it('warns when placed outside daw-editor', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      document.body.appendChild(shortcuts);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('must be placed inside a <daw-editor>')
      );
      document.body.removeChild(shortcuts);
      warnSpy.mockRestore();
    });

    it('clears editor ref on disconnect', () => {
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      expect((shortcuts as any)._editor).not.toBeNull();
      document.body.removeChild(editor);
      expect((shortcuts as any)._editor).toBeNull();
    });
  });

  describe('shortcuts getter', () => {
    it('returns empty array when no presets enabled and no custom shortcuts', () => {
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      expect((shortcuts as any).shortcuts).toEqual([]);
    });

    it('returns playback shortcuts when playback attribute set', () => {
      (shortcuts as any).playback = true;
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      const result = (shortcuts as any).shortcuts;
      expect(result.length).toBe(3);
      expect(result.map((s: any) => s.description)).toEqual([
        'Play/Pause',
        'Stop',
        'Rewind to start',
      ]);
    });

    it('returns splitting shortcut when splitting attribute set', () => {
      (shortcuts as any).splitting = true;
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      const result = (shortcuts as any).shortcuts;
      expect(result.length).toBe(1);
      expect(result[0].description).toBe('Split at playhead');
    });

    it('returns undo/redo shortcuts when undo attribute set', () => {
      (shortcuts as any).undo = true;
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      const result = (shortcuts as any).shortcuts;
      // 4 entries: Ctrl+Z, Cmd+Z (undo), Ctrl+Shift+Z, Cmd+Shift+Z (redo)
      expect(result.length).toBe(4);
      const descriptions = result.map((s: any) => s.description);
      expect(descriptions.filter((d: string) => d === 'Undo')).toHaveLength(2);
      expect(descriptions.filter((d: string) => d === 'Redo')).toHaveLength(2);
    });

    it('includes custom shortcuts', () => {
      const action = vi.fn();
      (shortcuts as any).customShortcuts = [{ key: 'x', action, description: 'Custom' }];
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      const result = (shortcuts as any).shortcuts;
      expect(result.length).toBe(1);
      expect(result[0].description).toBe('Custom');
    });

    it('combines presets and custom shortcuts', () => {
      (shortcuts as any).playback = true;
      (shortcuts as any).customShortcuts = [{ key: 'x', action: () => {}, description: 'Custom' }];
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      const result = (shortcuts as any).shortcuts;
      expect(result.length).toBe(4); // 3 playback + 1 custom
    });

    it('returns only customShortcuts when editor is null', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (shortcuts as any).playback = true;
      (shortcuts as any).customShortcuts = [{ key: 'x', action: () => {}, description: 'Custom' }];
      document.body.appendChild(shortcuts); // no parent editor
      const result = (shortcuts as any).shortcuts;
      expect(result.length).toBe(1);
      expect(result[0].description).toBe('Custom');
      document.body.removeChild(shortcuts);
      warnSpy.mockRestore();
    });
  });

  describe('remapping', () => {
    it('respects playbackShortcuts remap', () => {
      (shortcuts as any).playback = true;
      (shortcuts as any).playbackShortcuts = {
        playPause: { key: 'p' },
      };
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      const result = (shortcuts as any).shortcuts;
      expect(result[0].key).toBe('p');
      expect(result[0].description).toBe('Play/Pause');
    });

    it('respects splittingShortcuts remap', () => {
      (shortcuts as any).splitting = true;
      (shortcuts as any).splittingShortcuts = {
        splitAtPlayhead: { key: 'e', ctrlKey: true },
      };
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      const result = (shortcuts as any).shortcuts;
      expect(result[0].key).toBe('e');
      expect(result[0].ctrlKey).toBe(true);
    });

    it('respects undoShortcuts remap with explicit ctrlKey', () => {
      (shortcuts as any).undo = true;
      (shortcuts as any).undoShortcuts = {
        undo: { key: 'z', ctrlKey: true },
      };
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      const result = (shortcuts as any).shortcuts;
      // Explicit ctrlKey — no auto-expansion, just 1 undo + 2 redo
      const undos = result.filter((s: any) => s.description === 'Undo');
      expect(undos).toHaveLength(1);
      expect(undos[0].ctrlKey).toBe(true);
    });

    it('does not override user shiftKey on undo expansion', () => {
      (shortcuts as any).undo = true;
      (shortcuts as any).undoShortcuts = {
        undo: { key: 'y', shiftKey: true },
      };
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      const result = (shortcuts as any).shortcuts;
      const undos = result.filter((s: any) => s.description === 'Undo');
      // Auto-expanded (no ctrlKey/metaKey), but shiftKey preserved from user
      expect(undos).toHaveLength(2);
      for (const u of undos) {
        expect(u.shiftKey).toBe(true);
      }
    });
  });

  describe('splitting modifier guards', () => {
    it('default split shortcut has ctrlKey: false and metaKey: false', () => {
      (shortcuts as any).splitting = true;
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      const result = (shortcuts as any).shortcuts;
      expect(result[0].ctrlKey).toBe(false);
      expect(result[0].metaKey).toBe(false);
      expect(result[0].altKey).toBe(false);
    });
  });

  describe('playback modifier guards', () => {
    it('default playback shortcuts have ctrlKey: false and metaKey: false', () => {
      (shortcuts as any).playback = true;
      editor.appendChild(shortcuts);
      document.body.appendChild(editor);
      const result = (shortcuts as any).shortcuts;
      for (const s of result) {
        expect(s.ctrlKey).toBe(false);
        expect(s.metaKey).toBe(false);
      }
    });
  });
});
