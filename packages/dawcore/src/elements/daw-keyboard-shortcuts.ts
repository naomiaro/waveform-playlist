import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { handleKeyboardEvent } from '@waveform-playlist/core';
import type { KeyboardShortcut } from '@waveform-playlist/core';
import type { DawEditorElement } from './daw-editor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyBinding {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export interface PlaybackShortcutMap {
  playPause?: KeyBinding;
  stop?: KeyBinding;
  rewindToStart?: KeyBinding;
}

export interface SplittingShortcutMap {
  splitAtPlayhead?: KeyBinding;
}

export interface UndoShortcutMap {
  undo?: KeyBinding;
  redo?: KeyBinding;
}

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------

/**
 * Render-less element that enables keyboard shortcuts for a parent <daw-editor>.
 * Place inside the editor element. Boolean attributes enable preset categories;
 * JS properties allow remapping and custom shortcuts.
 *
 * ```html
 * <daw-editor>
 *   <daw-keyboard-shortcuts playback splitting undo></daw-keyboard-shortcuts>
 * </daw-editor>
 * ```
 */
@customElement('daw-keyboard-shortcuts')
export class DawKeyboardShortcutsElement extends LitElement {
  // --- Preset attributes ---
  @property({ type: Boolean }) playback = false;
  @property({ type: Boolean }) splitting = false;
  @property({ type: Boolean }) undo = false;

  // --- JS properties for remapping ---
  playbackShortcuts: PlaybackShortcutMap | null = null;
  splittingShortcuts: SplittingShortcutMap | null = null;
  undoShortcuts: UndoShortcutMap | null = null;

  /** Additional custom shortcuts. */
  customShortcuts: KeyboardShortcut[] = [];

  private _editor: DawEditorElement | null = null;

  /** All active shortcuts (read-only). */
  get shortcuts(): KeyboardShortcut[] {
    return this._buildShortcuts();
  }

  // --- Lifecycle ---

  override connectedCallback(): void {
    super.connectedCallback();
    this._editor = this.closest('daw-editor') as DawEditorElement | null;
    if (!this._editor) {
      console.warn('[dawcore] <daw-keyboard-shortcuts> must be placed inside a <daw-editor>');
    }
    document.addEventListener('keydown', this._onKeyDown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onKeyDown);
    this._editor = null;
  }

  // No shadow DOM — render-less element
  override createRenderRoot(): this {
    return this;
  }

  // --- Shortcut building ---

  private _buildShortcuts(): KeyboardShortcut[] {
    const editor = this._editor;
    if (!editor) return this.customShortcuts;

    const result: KeyboardShortcut[] = [];

    if (this.playback) {
      const map = this.playbackShortcuts;
      result.push(
        this._makeShortcut(
          map?.playPause ?? { key: ' ' },
          () => editor.togglePlayPause(),
          'Play/Pause'
        ),
        this._makeShortcut(map?.stop ?? { key: 'Escape' }, () => editor.stop(), 'Stop'),
        this._makeShortcut(
          map?.rewindToStart ?? { key: '0' },
          () => editor.seekTo(0),
          'Rewind to start'
        )
      );
    }

    if (this.splitting) {
      const map = this.splittingShortcuts;
      const binding = map?.splitAtPlayhead ?? {
        key: 's',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
      };
      result.push(this._makeShortcut(binding, () => editor.splitAtPlayhead(), 'Split at playhead'));
    }

    if (this.undo) {
      const map = this.undoShortcuts;
      const undoBinding = map?.undo ?? { key: 'z' };
      const redoBinding = map?.redo ?? { key: 'z', shiftKey: true };

      // Undo: Ctrl+Z (Win/Linux) and Cmd+Z (Mac)
      if (!undoBinding.ctrlKey && !undoBinding.metaKey) {
        result.push(
          this._makeShortcut(
            { ...undoBinding, ctrlKey: true, shiftKey: false },
            () => editor.undo(),
            'Undo'
          ),
          this._makeShortcut(
            { ...undoBinding, metaKey: true, shiftKey: false },
            () => editor.undo(),
            'Undo'
          )
        );
      } else {
        result.push(this._makeShortcut(undoBinding, () => editor.undo(), 'Undo'));
      }

      // Redo: Ctrl+Shift+Z (Win/Linux) and Cmd+Shift+Z (Mac)
      if (!redoBinding.ctrlKey && !redoBinding.metaKey) {
        result.push(
          this._makeShortcut(
            { ...redoBinding, ctrlKey: true, shiftKey: true },
            () => editor.redo(),
            'Redo'
          ),
          this._makeShortcut(
            { ...redoBinding, metaKey: true, shiftKey: true },
            () => editor.redo(),
            'Redo'
          )
        );
      } else {
        result.push(this._makeShortcut(redoBinding, () => editor.redo(), 'Redo'));
      }
    }

    result.push(...this.customShortcuts);
    return result;
  }

  private _makeShortcut(
    binding: KeyBinding,
    action: () => void,
    description: string
  ): KeyboardShortcut {
    return {
      key: binding.key,
      ...(binding.ctrlKey !== undefined && { ctrlKey: binding.ctrlKey }),
      ...(binding.shiftKey !== undefined && { shiftKey: binding.shiftKey }),
      ...(binding.metaKey !== undefined && { metaKey: binding.metaKey }),
      ...(binding.altKey !== undefined && { altKey: binding.altKey }),
      action,
      description,
    };
  }

  // --- Event handler ---

  private _onKeyDown = (e: KeyboardEvent) => {
    const shortcuts = this._buildShortcuts();
    if (shortcuts.length === 0) return;
    try {
      handleKeyboardEvent(e, shortcuts, true);
    } catch (err) {
      console.warn('[dawcore] Keyboard shortcut failed: ' + String(err));
      this._editor?.dispatchEvent(
        new CustomEvent('daw-error', {
          bubbles: true,
          composed: true,
          detail: { operation: 'keyboard-shortcut', error: err },
        })
      );
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-keyboard-shortcuts': DawKeyboardShortcutsElement;
  }
}
