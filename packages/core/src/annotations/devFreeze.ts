/**
 * Outside production builds, freeze what the annotation store hands out. The
 * same objects are shared by the store, every reader and every later list
 * built from them, so a write by a consumer would change all of them; frozen,
 * the write throws where it is made (in a module, which is strict code).
 *
 * Frozen: the array, each annotation and its `lines` array.
 *
 * Not exported from the package: core's index re-exports `store.ts` and
 * `bounds.ts` only.
 */

import type { AnnotationData } from '../types';

declare const process: { env: { NODE_ENV?: string } };

/**
 * True unless this is a production build. Bundlers replace
 * `process.env.NODE_ENV` with a literal; where there is no `process` at all
 * (a page that loads the module without a bundler) this is false.
 */
export function isDevelopmentBuild(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

/** Freeze `list`, each annotation and its `lines` in development; return `list`. */
export function freezeAnnotations(list: readonly AnnotationData[]): readonly AnnotationData[] {
  if (!isDevelopmentBuild()) return list;
  for (const annotation of list) {
    if (Array.isArray(annotation.lines)) Object.freeze(annotation.lines);
    Object.freeze(annotation);
  }
  return Object.freeze(list);
}
