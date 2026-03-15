import { defineConfig } from 'vite';
import path from 'node:path';

const packageDir = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(packageDir, '../..');

export default defineConfig({
  root: packageDir,
  publicDir: path.resolve(repoRoot, 'website/static'),
  server: {
    port: 5173,
    open: false,
  },
});
