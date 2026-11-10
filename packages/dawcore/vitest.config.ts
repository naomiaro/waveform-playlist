import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup/wait-timeout.ts'],
  },
});
