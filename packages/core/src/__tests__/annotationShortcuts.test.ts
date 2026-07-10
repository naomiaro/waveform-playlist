import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ANNOTATION_SHORTCUTS,
  resolveAnnotationShortcuts,
} from '../annotations/shortcuts';

describe('annotation shortcuts', () => {
  it('defaults match the spec table', () => {
    expect(DEFAULT_ANNOTATION_SHORTCUTS.selectPrevious.map((b) => b.key)).toEqual([
      'ArrowUp',
      'ArrowLeft',
    ]);
    expect(DEFAULT_ANNOTATION_SHORTCUTS.selectNext.map((b) => b.key)).toEqual([
      'ArrowDown',
      'ArrowRight',
    ]);
    expect(DEFAULT_ANNOTATION_SHORTCUTS.playActive[0].key).toBe('Enter');
    expect(DEFAULT_ANNOTATION_SHORTCUTS.moveStartEarlier[0].key).toBe('[');
    expect(DEFAULT_ANNOTATION_SHORTCUTS.moveEndLater[0].key).toBe('}');
  });

  it('resolve with null returns all defaults flattened', () => {
    const entries = resolveAnnotationShortcuts(null);
    const nextEntries = entries.filter((e) => e.action === 'selectNext');
    expect(nextEntries).toHaveLength(2);
  });

  it('partial remap overrides only the named action', () => {
    const entries = resolveAnnotationShortcuts({ selectNext: { key: 'j' } });
    const nextEntries = entries.filter((e) => e.action === 'selectNext');
    expect(nextEntries).toHaveLength(1);
    expect(nextEntries[0].binding.key).toBe('j');
    const prevEntries = entries.filter((e) => e.action === 'selectPrevious');
    expect(prevEntries).toHaveLength(2); // untouched defaults
  });
});
