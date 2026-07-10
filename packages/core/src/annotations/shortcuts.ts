import type { KeyBinding } from '../keyboard';

export type AnnotationShortcutAction =
  | 'selectPrevious'
  | 'selectNext'
  | 'selectFirst'
  | 'selectLast'
  | 'clearSelection'
  | 'moveStartEarlier'
  | 'moveStartLater'
  | 'moveEndEarlier'
  | 'moveEndLater'
  | 'playActive';

/** Key remapping map — null on the consumer means "use defaults". */
export interface AnnotationShortcutMap {
  selectPrevious?: KeyBinding;
  selectNext?: KeyBinding;
  selectFirst?: KeyBinding;
  selectLast?: KeyBinding;
  clearSelection?: KeyBinding;
  moveStartEarlier?: KeyBinding;
  moveStartLater?: KeyBinding;
  moveEndEarlier?: KeyBinding;
  moveEndLater?: KeyBinding;
  playActive?: KeyBinding;
}

// Explicit ctrlKey/metaKey: false so browser combos (Cmd+ArrowLeft = history
// back, Cmd+[ = back, etc.) never trigger annotation actions — same convention
// as <daw-keyboard-shortcuts> presets.
const noMods = { ctrlKey: false as const, metaKey: false as const };

export const DEFAULT_ANNOTATION_SHORTCUTS: Record<AnnotationShortcutAction, KeyBinding[]> = {
  selectPrevious: [
    { key: 'ArrowUp', ...noMods },
    { key: 'ArrowLeft', ...noMods },
  ],
  selectNext: [
    { key: 'ArrowDown', ...noMods },
    { key: 'ArrowRight', ...noMods },
  ],
  selectFirst: [{ key: 'Home', ...noMods }],
  selectLast: [{ key: 'End', ...noMods }],
  clearSelection: [{ key: 'Escape', ...noMods }],
  moveStartEarlier: [{ key: '[', ...noMods }],
  moveStartLater: [{ key: ']', ...noMods }],
  // '{' / '}' are what event.key reports for Shift+[ / Shift+] — no explicit
  // shiftKey needed; the key value itself encodes it.
  moveEndEarlier: [{ key: '{', ...noMods }],
  moveEndLater: [{ key: '}', ...noMods }],
  playActive: [{ key: 'Enter', ...noMods }],
};

const ALL_ACTIONS = Object.keys(DEFAULT_ANNOTATION_SHORTCUTS) as AnnotationShortcutAction[];

/**
 * Flatten defaults + remap into a matchable list. A remapped action replaces
 * ALL of its default bindings with the single provided binding.
 */
export function resolveAnnotationShortcuts(
  remap: AnnotationShortcutMap | null
): Array<{ action: AnnotationShortcutAction; binding: KeyBinding }> {
  return ALL_ACTIONS.flatMap((action) => {
    const override = remap?.[action];
    const bindings = override ? [override] : DEFAULT_ANNOTATION_SHORTCUTS[action];
    return bindings.map((binding) => ({ action, binding }));
  });
}
