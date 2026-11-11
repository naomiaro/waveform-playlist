// Compile Faust DSP ahead of time, for the precompiled-Faust demos and for
// the WAM fixtures under website/static/faust-wams/.
//
//   pnpm example:faust:compile              → examples/faust-precompiled/compiled/
//   pnpm example:faust:compile --fixtures   → regenerate website/static/faust-wams/*
//
// Two targets per effect:
//
//   worklet/  `faust2wasm` (from @grame/faustwasm) — the effect's wasm + metadata
//             and a copy of the faustwasm runtime. Loaded with registerEffect().
//   wam/      `faust2wam` (from @shren/faust2wam) — a static WAM 2.0 plugin.
//             Loaded with addWamPlugin(url).
//
// Licensing of what gets written (see the guide): the faustwasm runtime is
// LGPL; faust2wam's templates are LGPL-3.0; the WAM SDK is MIT. faust2wam
// ALSO vendors faust-ui, which is GPL-3.0-or-later — this script removes it
// (stripFaustUi) so nothing GPL lands in the output. The plugin then has no
// GUI of its own and hosts fall back to their generic parameter panel.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

// Both CLIs are dependencies of @dawcore/faust (faustwasm transitively), so
// resolve them from there instead of adding root devDependencies.
const fromFaustPackage = createRequire(path.join(repoRoot, 'packages/dawcore-faust/package.json'));
const faust2wamDir = path.dirname(fromFaustPackage.resolve('@shren/faust2wam/package.json'));
const fromFaust2wam = createRequire(path.join(faust2wamDir, 'package.json'));
const faustwasmDir = path.dirname(fromFaust2wam.resolve('@grame/faustwasm/package.json'));

const FAUST2WAM = path.join(faust2wamDir, 'faust2wam.js');
const FAUST2WASM = path.join(faustwasmDir, 'scripts/faust2wasm.js');

function run(cli, args) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      'Faust compile failed (' +
        path.basename(cli) +
        ' ' +
        args.join(' ') +
        '):\n' +
        (result.stdout || '') +
        (result.stderr || '')
    );
  }
}

function removeAll(dir, names) {
  for (const name of names) {
    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

/** Delete source maps and type declarations — not needed to run the effect. */
function pruneDevFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) pruneDevFiles(full);
    else if (/\.(map|d\.ts)$/.test(entry.name)) fs.rmSync(full);
  }
}

/**
 * Remove faust-ui (GPL-3.0-or-later) from a faust2wam output directory.
 * The generated index.js imports ./gui.js, which imports ./faust-ui/; drop
 * both and the plugin's createGui() override. WebAudioModule's base class
 * then reports no GUI, and hosts show their own parameter panel.
 */
export function stripFaustUi(wamDir) {
  removeAll(wamDir, ['faust-ui', 'gui.js']);
  const indexPath = path.join(wamDir, 'index.js');
  const source = fs.readFileSync(indexPath, 'utf8');
  const importLine = "import createElement from './gui.js';\n";
  const guiMethod = /\n\tcreateGui\(\) \{\n\t\treturn createElement\(this\);\n\t\}\n/;
  if (!source.includes(importLine) || !guiMethod.test(source)) {
    throw new Error(
      'stripFaustUi: ' +
        indexPath +
        ' does not look like faust2wam output — ' +
        'the template changed; update this script before shipping the result.'
    );
  }
  const stripped = source
    .replace(importLine, '')
    .replace(
      guiMethod,
      '\n\t// createGui() removed by examples/faust-precompiled/compile.mjs: the\n' +
        '\t// generated GUI depends on faust-ui (GPL-3.0-or-later), which is not shipped.\n'
    );
  if (/gui\.js|createElement\(|from ['"]\.\/faust-ui/.test(stripped)) {
    throw new Error('stripFaustUi: GUI imports remain in ' + indexPath);
  }
  fs.writeFileSync(indexPath, stripped);
}

/**
 * Build into a sibling temp folder and move it into place only when every
 * step succeeded — a failure partway (say, in stripFaustUi) must never leave
 * a half-written or still-GPL folder where the last good one was.
 */
function buildAtomically(outDir, build) {
  const staging = outDir + '.tmp';
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(outDir), { recursive: true });
  try {
    build(staging);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.renameSync(staging, outDir);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

/** `faust2wam` → a static WAM plugin directory without faust-ui. */
export function compileWam(dspFile, outDir) {
  buildAtomically(outDir, (staging) => {
    run(FAUST2WAM, [dspFile, staging]);
    // fftw/ is only for -fft plugins; host/ is faust2wam's standalone test page.
    removeAll(staging, ['fftw', 'host', 'types.d.ts']);
    pruneDevFiles(staging);
    stripFaustUi(staging);
  });
}

/** `faust2wasm` → wasm + metadata + the faustwasm runtime. */
export function compileWorklet(dspFile, outDir) {
  buildAtomically(outDir, (staging) => {
    run(FAUST2WASM, [dspFile, staging]);
    // index.html / index.js / create-node.js are faustwasm's standalone demo
    // page; the demos here create the node themselves.
    removeAll(staging, ['index.html', 'index.js', 'create-node.js']);
    pruneDevFiles(staging);
  });
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--fixtures')) {
    const fixturesDir = path.join(repoRoot, 'website/static/faust-wams');
    for (const name of ['lowpass', 'reverb', 'flanger']) {
      const target = path.join(fixturesDir, name);
      const dsp = fs.readFileSync(path.join(target, name + '.dsp'), 'utf8');
      // compileWam clears the target directory, so compile from a copy. Keep
      // the file NAME: the compiler records it in dsp-meta.json.
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faust-fixture-'));
      const tmpDsp = path.join(tmpDir, name + '.dsp');
      fs.writeFileSync(tmpDsp, dsp);
      try {
        compileWam(tmpDsp, target);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
      fs.writeFileSync(path.join(target, name + '.dsp'), dsp);
      console.log('fixture ' + name + ': ' + listFiles(target).length + ' files');
    }
  } else {
    const dsp = path.join(here, 'tremolo.dsp');
    const out = path.join(here, 'compiled');
    compileWorklet(dsp, path.join(out, 'worklet'));
    compileWam(dsp, path.join(out, 'wam'));
    for (const target of ['worklet', 'wam']) {
      console.log(target + '/\n  ' + listFiles(path.join(out, target)).sort().join('\n  '));
    }
  }
}
