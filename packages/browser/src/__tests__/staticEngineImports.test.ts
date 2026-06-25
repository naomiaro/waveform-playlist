// Issue #510: FAST NON-TRANSITIVE guard — scans each listed file individually
// (no bundling). It catches direct static imports in those files, but NOT
// transitive imports introduced by their dependencies (e.g. a helper they call
// that itself imports tone). For the authoritative barrel-level guarantee, see
// `coreBarrelEngineFree.test.ts` which bundles src/index.tsx end-to-end with
// esbuild and asserts zero static tone/@waveform-playlist/playout imports in
// the entire transitive closure.
//
// The provider/render static import graph must never STATICALLY (non-type)
// import the optional engines or tone. `import type` and dynamic `import()`
// are allowed. This guards criteria 2 (MediaElement-only) and 3 (custom
// adapter) at the source level.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'WaveformPlaylistContext.tsx',
  'playout/resolvePlayoutAdapter.ts',
  'playout/resolveMediaElementPlayout.ts',
  'MediaElementPlaylistContext.tsx',
  'components/PlaylistVisualization.tsx',
  'index.tsx',
  'soundFontSync.ts',
  'hooks/useAnnotationDragHandlers.ts',
];

const FORBIDDEN = [
  'tone',
  '@waveform-playlist/playout',
  '@waveform-playlist/media-element-playout',
];

// `import (type)? ... from '<spec>'` (multi-line bodies via [\s\S]*?) plus
// side-effect `import '<spec>'`. Dynamic import() / typeof import() have no
// `from` and no `import<space><quote>`, so they are not matched.
const IMPORT_RE = /import\s+(type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT_RE = /import\s+(['"])([^'"]+)\1/g;

function staticRuntimeSpecifiers(source: string): string[] {
  const specs: string[] = [];
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(source))) {
    if (!m[1]) specs.push(m[2]); // m[1] === 'type ' → type-only import, skip
  }
  SIDE_EFFECT_RE.lastIndex = 0;
  while ((m = SIDE_EFFECT_RE.exec(source))) {
    specs.push(m[2]);
  }
  return specs;
}

describe('provider static import graph stays engine-free (#510)', () => {
  for (const rel of FILES) {
    it(`${rel}: no static (non-type) import of tone/playout/media-element-playout`, () => {
      const source = readFileSync(join(srcDir, rel), 'utf8');
      const offenders = staticRuntimeSpecifiers(source).filter((s) => FORBIDDEN.includes(s));
      expect(offenders).toEqual([]);
    });
  }
});
