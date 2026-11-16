import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The tests were written against jsdom (see the Blob note in loadMidiTracks.test.ts).
    environment: 'jsdom',
  },
});
