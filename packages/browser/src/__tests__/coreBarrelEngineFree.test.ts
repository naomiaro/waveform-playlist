// Issue #510: the CORE entry (@waveform-playlist/browser → src/index.tsx) must
// have NO static (non-type) import of tone / @waveform-playlist/playout anywhere
// in its TRANSITIVE graph, so MediaElement-only and custom-adapter consumers
// never resolve/bundle them under ANY bundler. esbuild does NOT tree-shake
// side-effectful external imports, so a clean esbuild bundle proves structural
// absence (not mere tree-shakeability). Dynamic import() is allowed.
import { describe, it, expect } from 'vitest';
import { build } from 'esbuild';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function staticEngineImportsInEntry(entry: string): Promise<string[]> {
  const result = await build({
    entryPoints: [join(pkgRoot, entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    treeShaking: true,
    logLevel: 'silent',
    external: [
      'tone',
      '@waveform-playlist/*',
      'react',
      'react-dom',
      'react/jsx-runtime',
      'styled-components',
      '@dnd-kit/*',
      'waveform-data',
      'uuid',
    ],
  });
  const code = result.outputFiles[0].text;
  // Static `… from "tone"` / `… from "@waveform-playlist/playout"`. Dynamic
  // import("…") has no `from` and is not matched.
  const re =
    /from\s*"(tone|@waveform-playlist\/playout|@waveform-playlist\/media-element-playout)"/g;
  return [...code.matchAll(re)].map((m) => m[1]);
}

describe('core barrel is engine-free (#510)', () => {
  it('src/index.tsx has no transitive static import of tone / playout', async () => {
    const offenders = await staticEngineImportsInEntry('src/index.tsx');
    expect(offenders).toEqual([]);
  });

  it('src/tone.ts (the Tone subpath) DOES pull tone/playout (sanity — proves the test detects them)', async () => {
    const found = await staticEngineImportsInEntry('src/tone.ts');
    expect(found.length).toBeGreaterThan(0);
  });
});
