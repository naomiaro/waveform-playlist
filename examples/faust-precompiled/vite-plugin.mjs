// Serves examples/faust-precompiled/compiled/ at /faust-compiled/ — as PLAIN
// STATIC FILES, in dev and in a production build.
//
// That is deliberate. The faustwasm runtime builds its AudioWorklet processor
// from the source text of its own classes at load time. If a bundler renames
// or minifies that runtime, the generated processor breaks (#658). So the
// compiled folder must never go through the bundler: it is served untouched
// here, and the demos load it with a runtime URL import.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const compiledDir = path.join(here, 'compiled');
const MOUNT = '/faust-compiled';
const TYPES = {
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
};

async function ensureCompiled() {
  // Both targets must be complete; each is moved into place only after its
  // whole build succeeded (compile.mjs), so existence means usable.
  const complete =
    fs.existsSync(path.join(compiledDir, 'worklet', 'dsp-module.wasm')) &&
    fs.existsSync(path.join(compiledDir, 'wam', 'index.js'));
  if (complete) return;
  const { compileWorklet, compileWam } = await import('./compile.mjs');
  const dsp = path.join(here, 'tremolo.dsp');
  compileWorklet(dsp, path.join(compiledDir, 'worklet'));
  compileWam(dsp, path.join(compiledDir, 'wam'));
}

export function serveCompiledFaust() {
  return {
    name: 'serve-compiled-faust',
    async buildStart() {
      await ensureCompiled();
    },
    configureServer(server) {
      server.middlewares.use(MOUNT, (req, res, next) => {
        const relative = decodeURIComponent((req.url || '/').split('?')[0]);
        const file = path.join(compiledDir, relative);
        // Stay inside the compiled folder.
        if (!file.startsWith(compiledDir + path.sep) || !fs.existsSync(file)) {
          next();
          return;
        }
        if (!fs.statSync(file).isFile()) {
          next();
          return;
        }
        res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(file).pipe(res);
      });
    },
    writeBundle(options) {
      if (!options.dir) return;
      fs.cpSync(compiledDir, path.join(options.dir, MOUNT.slice(1)), { recursive: true });
    },
  };
}
