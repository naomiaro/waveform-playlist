/**
 * Keeps a template of React elements while a new one says the same thing
 * (#687).
 *
 * `<WaveformTrackControls>` renders its children once per track. Children
 * written inline are new element objects on every render of the component
 * that composes the view, which usually holds the tracks and renders on every
 * move of a trim: handed on as they are, they rendered every piece of every
 * track each time (measured on the multi-clip example: 237 components per
 * trim move against 83). Two elements describe the same thing when their
 * type, key and props are equal, so the previous template can stand in for an
 * equal new one, and React then skips everything below it.
 */
import { isValidElement, useRef, type ReactNode } from 'react';

function sameStyle(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const one = a as Record<string, unknown>;
  const other = b as Record<string, unknown>;
  const keys = Object.keys(one);
  return (
    keys.length === Object.keys(other).length && keys.every((k) => Object.is(one[k], other[k]))
  );
}

/**
 * Whether two templates describe the same elements: the same types and keys,
 * and props that are identical (`Object.is`), except `children` (compared the
 * same way, recursively) and `style` (compared one level deep, because a
 * style object is usually written inline). A function or an object written
 * inline as any other prop makes the templates differ.
 */
export function sameTemplate(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameTemplate(item, b[index]));
  }
  if (isValidElement(a) && isValidElement(b)) {
    if (a.type !== b.type || a.key !== b.key) return false;
    const one = a.props as Record<string, unknown>;
    const other = b.props as Record<string, unknown>;
    const keys = Object.keys(one);
    if (keys.length !== Object.keys(other).length) return false;
    return keys.every((key) => {
      if (!(key in other)) return false;
      if (key === 'children') return sameTemplate(one[key], other[key]);
      if (key === 'style') return sameStyle(one[key], other[key]);
      return Object.is(one[key], other[key]);
    });
  }
  return false;
}

/**
 * The template to render: the previous one while `template` is equal to it by
 * `sameTemplate`, else `template`.
 *
 * The ref is written during render. That is safe here: whatever it holds is a
 * template some render was given, and it is only ever used in place of one
 * that is equal to it.
 */
export function useStableTemplate(template: ReactNode): ReactNode {
  const kept = useRef(template);
  if (!sameTemplate(kept.current, template)) {
    kept.current = template;
  }
  return kept.current;
}
