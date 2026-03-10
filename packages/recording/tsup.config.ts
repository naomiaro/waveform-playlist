import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['tone', 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'styled-components'],
});
