# daw-editor Adapter Pluggability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `<daw-editor>` adapter-agnostic so consumers choose their audio backend (NativePlayoutAdapter or TonePlayoutAdapter), and add single-tempo/meter support to TonePlayoutAdapter.

**Architecture:** Add `audioContext` (required) and `ppqn` (optional) to the `PlayoutAdapter` interface. `<daw-editor>` requires an `adapter` property — no default created. `TonePlayoutAdapter` gains 4 tempo/meter methods with single-value support (throws on multi-tempo/meter). Dev pages and website examples updated to explicit adapter wiring.

**Tech Stack:** TypeScript, Lit (dawcore web components), Tone.js (playout), vitest (tests), Docusaurus (website)

**Spec:** `docs/superpowers/specs/2026-04-25-daw-editor-adapter-pluggability-design.md`

---

### Task 1: Add `audioContext` and `ppqn` to PlayoutAdapter interface

**Files:**
- Modify: `packages/engine/src/types.ts:8-38`
- Test: `packages/engine/src/__tests__/PlaylistEngine.test.ts`

- [ ] **Step 1: Add properties to PlayoutAdapter interface**

In `packages/engine/src/types.ts`, add two properties to the `PlayoutAdapter` interface:

```typescript
export interface PlayoutAdapter {
  /** The AudioContext used by this adapter for all audio operations. */
  readonly audioContext: AudioContext;
  /** Pulses per quarter note. Engine uses this to align tick resolution. */
  readonly ppqn?: number;
  init(): Promise<void>;
  // ... rest unchanged
}
```

Add `readonly audioContext: AudioContext;` as the first property and `readonly ppqn?: number;` as the second.

- [ ] **Step 2: Update engine test mock adapter to include audioContext**

In `packages/engine/src/__tests__/PlaylistEngine.test.ts`, find the mock adapter factory (search for `function createMockAdapter` or the adapter mock object). Add `audioContext` to the mock:

```typescript
const mockAudioContext = {
  sampleRate: 48000,
  state: 'running',
} as unknown as AudioContext;
```

Add `audioContext: mockAudioContext` to every mock adapter object in the file.

- [ ] **Step 3: Run engine tests**

Run: `cd packages/engine && npx vitest run`
Expected: All tests pass. The new properties are compatible — `audioContext` is required but existing mocks need updating, `ppqn` is optional.

- [ ] **Step 4: Run typecheck**

Run: `cd packages/engine && pnpm typecheck`
Expected: Pass. Other packages that implement `PlayoutAdapter` will fail (fixed in later tasks).

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/types.ts packages/engine/src/__tests__/PlaylistEngine.test.ts
git commit -m "feat(engine): add audioContext and ppqn to PlayoutAdapter interface"
```

---

### Task 2: Add `audioContext` and `ppqn` getters to NativePlayoutAdapter

**Files:**
- Modify: `packages/transport/src/adapter.ts`
- Test: existing transport tests

- [ ] **Step 1: Add `audioContext` getter**

The `_audioContext` field already exists on `NativePlayoutAdapter`. Add a public getter in `packages/transport/src/adapter.ts`:

```typescript
get audioContext(): AudioContext {
  return this._audioContext;
}
```

Add it after the constructor, before the existing `transport` getter.

- [ ] **Step 2: Add `ppqn` getter**

The Transport stores PPQN internally. Check how to access it — look for a `ppqn` getter on Transport. If none exists, add one to Transport first, then surface it on the adapter.

In `packages/transport/src/adapter.ts`, add:

```typescript
get ppqn(): number {
  return this._transport.ppqn;
}
```

If `Transport` doesn't expose `ppqn`, add a getter to `packages/transport/src/transport.ts`:

```typescript
get ppqn(): number {
  return this._ppqn;
}
```

- [ ] **Step 3: Run transport tests**

Run: `cd packages/transport && npx vitest run`
Expected: All tests pass. New getters are additive.

- [ ] **Step 4: Commit**

```bash
git add packages/transport/src/adapter.ts packages/transport/src/transport.ts
git commit -m "feat(transport): expose audioContext and ppqn getters on NativePlayoutAdapter"
```

---

### Task 3: Add tempo/meter methods and `audioContext`/`ppqn` to TonePlayoutAdapter

**Files:**
- Modify: `packages/playout/src/TonePlayoutAdapter.ts`
- Test: `packages/playout/src/__tests__/TonePlayoutAdapter.test.ts`

- [ ] **Step 1: Write failing tests for setTempo**

In `packages/playout/src/__tests__/TonePlayoutAdapter.test.ts`, add a new describe block:

```typescript
describe('tempo and meter', () => {
  it('setTempo sets the BPM', () => {
    const adapter = createToneAdapter();
    adapter.setTempo!(120);
    // Verify via ticksToSeconds (at 120 BPM, 192 PPQ: 1 beat = 192 ticks = 0.5s)
    expect(adapter.ticksToSeconds!(192)).toBeCloseTo(0.5);
  });

  it('setTempo throws when atTick is provided', () => {
    const adapter = createToneAdapter();
    expect(() => adapter.setTempo!(140, 960)).toThrow(
      'Multiple tempo changes not supported'
    );
  });

  it('setMeter sets time signature', () => {
    const adapter = createToneAdapter();
    // Should not throw
    adapter.setMeter!(3, 4);
  });

  it('setMeter throws when atTick is provided', () => {
    const adapter = createToneAdapter();
    expect(() => adapter.setMeter!(6, 8, 960)).toThrow(
      'Multiple meter changes not supported'
    );
  });

  it('ticksToSeconds converts using current BPM and ppqn', () => {
    const adapter = createToneAdapter();
    // Default: 120 BPM, 192 PPQ
    // 384 ticks = 2 beats = 1 second at 120 BPM
    expect(adapter.ticksToSeconds!(384)).toBeCloseTo(1.0);
  });

  it('secondsToTicks converts using current BPM and ppqn', () => {
    const adapter = createToneAdapter();
    // 1 second at 120 BPM, 192 PPQ = 384 ticks
    expect(adapter.secondsToTicks!(1.0)).toBeCloseTo(384);
  });

  it('ticksToSeconds reflects updated BPM', () => {
    const adapter = createToneAdapter();
    adapter.setTempo!(60);
    // At 60 BPM, 192 PPQ: 192 ticks = 1 beat = 1 second
    expect(adapter.ticksToSeconds!(192)).toBeCloseTo(1.0);
  });

  it('accepts custom ppqn via options', () => {
    const adapter = createToneAdapter({ ppqn: 960 });
    // At 120 BPM, 960 PPQ: 960 ticks = 1 beat = 0.5 seconds
    expect(adapter.ticksToSeconds!(960)).toBeCloseTo(0.5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/playout && npx vitest run`
Expected: FAIL — `setTempo`, `setMeter`, `ticksToSeconds`, `secondsToTicks` don't exist, `ppqn` option not recognized.

- [ ] **Step 3: Add ppqn to ToneAdapterOptions**

In `packages/playout/src/TonePlayoutAdapter.ts`, update the options interface:

```typescript
export interface ToneAdapterOptions {
  effects?: EffectsFunction;
  /** When provided, MIDI clips use SoundFont sample playback instead of PolySynth */
  soundFontCache?: SoundFontCache;
  /** Pulses per quarter note. Defaults to 192 (Tone.js native). */
  ppqn?: number;
}
```

- [ ] **Step 4: Implement the methods**

In the `createToneAdapter` function body, add state variables after the existing ones (after `let _pendingInit`):

```typescript
const _ppqn = options?.ppqn ?? 192;
let _bpm = 120;
let _numerator = 4;
let _denominator = 4;
```

In the returned object (after the `dispose` method), add:

```typescript
get audioContext(): AudioContext {
  return getGlobalAudioContext();
},

get ppqn(): number {
  return _ppqn;
},

setTempo(bpm: number, atTick?: number): void {
  if (atTick !== undefined) {
    throw new Error(
      'Multiple tempo changes not supported by TonePlayoutAdapter. ' +
      'Use NativePlayoutAdapter from @dawcore/transport for multi-tempo support.'
    );
  }
  _bpm = bpm;
},

setMeter(numerator: number, denominator: number, atTick?: number): void {
  if (atTick !== undefined) {
    throw new Error(
      'Multiple meter changes not supported by TonePlayoutAdapter. ' +
      'Use NativePlayoutAdapter from @dawcore/transport for multi-meter support.'
    );
  }
  _numerator = numerator;
  _denominator = denominator;
},

ticksToSeconds(tick: number): number {
  return (tick * 60) / (_bpm * _ppqn);
},

secondsToTicks(seconds: number): number {
  return (seconds * _bpm * _ppqn) / 60;
},
```

Add the `getGlobalAudioContext` import at the top of the file:

```typescript
import { getGlobalAudioContext } from './audioContext';
```

- [ ] **Step 5: Write test for audioContext getter**

Add to the test file:

```typescript
describe('audioContext', () => {
  it('exposes the global audio context', () => {
    const adapter = createToneAdapter();
    expect(adapter.audioContext).toBeDefined();
    expect(adapter.audioContext.sampleRate).toBe(48000);
  });
});
```

Note: The mock setup in this test file already mocks `getGlobalAudioContext`. Verify the mock returns an object with `sampleRate`.

- [ ] **Step 6: Write test for ppqn getter**

Add to the test file:

```typescript
describe('ppqn', () => {
  it('defaults to 192', () => {
    const adapter = createToneAdapter();
    expect(adapter.ppqn).toBe(192);
  });

  it('uses custom ppqn from options', () => {
    const adapter = createToneAdapter({ ppqn: 960 });
    expect(adapter.ppqn).toBe(960);
  });
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd packages/playout && npx vitest run`
Expected: All tests pass including new tempo/meter/ppqn/audioContext tests.

- [ ] **Step 8: Commit**

```bash
git add packages/playout/src/TonePlayoutAdapter.ts packages/playout/src/__tests__/TonePlayoutAdapter.test.ts
git commit -m "feat(playout): add tempo/meter methods, audioContext and ppqn to TonePlayoutAdapter"
```

---

### Task 4: Make `<daw-editor>` adapter-pluggable

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`
- Modify: `packages/dawcore/package.json`
- Test: `packages/dawcore/src/__tests__/daw-editor.test.ts`

This is the largest task. It changes `<daw-editor>` to require an externally-provided adapter.

- [ ] **Step 1: Write failing test — error when no adapter set**

In `packages/dawcore/src/__tests__/daw-editor.test.ts`, add:

```typescript
describe('adapter pluggability', () => {
  it('throws when _ensureEngine is called without adapter', async () => {
    const editor = document.createElement('daw-editor') as any;
    document.body.appendChild(editor);
    await expect(editor._ensureEngine()).rejects.toThrow('No PlayoutAdapter set');
    editor.remove();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run -- daw-editor.test`
Expected: FAIL — currently `_buildEngine` auto-creates a `NativePlayoutAdapter`.

- [ ] **Step 3: Add adapter property, remove transport getter, update audioContext**

In `packages/dawcore/src/elements/daw-editor.ts`:

**Add adapter property** (near the other properties, around line 190):

```typescript
@property({ attribute: false })
set adapter(value: PlayoutAdapter | null) {
  this._externalAdapter = value;
}
get adapter(): PlayoutAdapter | null {
  return this._externalAdapter;
}
private _externalAdapter: PlayoutAdapter | null = null;
```

**Remove the `transport` getter** (around line 216-218):

```typescript
// DELETE:
get transport(): Transport | null {
  return this._adapter?.transport ?? null;
}
```

**Update `audioContext` getter** — remove setter, `_externalAudioContext`, `_ownedAudioContext`. Replace with:

```typescript
get audioContext(): AudioContext {
  if (!this._externalAdapter) {
    throw new Error(
      'No PlayoutAdapter set on <daw-editor>. ' +
      'Set editor.adapter before accessing audioContext.\n\n' +
      '  // Option 1: Native Web Audio (no Tone.js)\n' +
      '  npm install @dawcore/transport\n' +
      '  import { NativePlayoutAdapter } from \'@dawcore/transport\';\n' +
      '  editor.adapter = new NativePlayoutAdapter(new AudioContext());\n\n' +
      '  // Option 2: Tone.js (effects, MIDI synths)\n' +
      '  npm install @waveform-playlist/playout\n' +
      '  import { createToneAdapter } from \'@waveform-playlist/playout\';\n' +
      '  editor.adapter = createToneAdapter();'
    );
  }
  return this._externalAdapter.audioContext;
}
```

Remove the `audioContext` setter, `_externalAudioContext`, and `_ownedAudioContext` fields.

**Remove `sample-rate` attribute** — remove the `@property` decorator and `sampleRate` property that creates AudioContext with a specific rate. Make `sampleRate` a derived getter:

```typescript
get sampleRate(): number {
  return this._resolvedSampleRate ?? this._externalAdapter?.audioContext.sampleRate ?? 48000;
}
```

Remove the `set sampleRate` and the `@property({ type: Number, noAccessor: true })` decorator for sampleRate. Keep `_resolvedSampleRate` as the internal field set from decoded audio.

- [ ] **Step 4: Update `_buildEngine()` — use external adapter**

Replace the `_buildEngine()` method. Remove the dynamic `import('@dawcore/transport')` and `new NativePlayoutAdapter(this.audioContext)`. Use the adapter from the property:

```typescript
private async _buildEngine() {
  if (!this._externalAdapter) {
    throw new Error(
      'No PlayoutAdapter set on <daw-editor>. ' +
      'Set editor.adapter before use.\n\n' +
      '  // Option 1: Native Web Audio (no Tone.js)\n' +
      '  npm install @dawcore/transport\n' +
      '  import { NativePlayoutAdapter } from \'@dawcore/transport\';\n' +
      '  editor.adapter = new NativePlayoutAdapter(new AudioContext());\n\n' +
      '  // Option 2: Tone.js (effects, MIDI synths)\n' +
      '  npm install @waveform-playlist/playout\n' +
      '  import { createToneAdapter } from \'@waveform-playlist/playout\';\n' +
      '  editor.adapter = createToneAdapter();'
    );
  }

  const { PlaylistEngine } = await import('@waveform-playlist/engine');
  const adapter = this._externalAdapter;

  // Forward initial tempo if adapter supports it
  adapter.setTempo?.(this._bpm);

  const engine = new PlaylistEngine({
    adapter,
    sampleRate: this.effectiveSampleRate,
    samplesPerPixel: this.samplesPerPixel,
    bpm: this._bpm,
    ppqn: adapter.ppqn ?? this._ppqn,
    zoomLevels: [256, 512, 1024, 2048, 4096, 8192, this.samplesPerPixel]
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a - b),
  });

  // ... keep existing statechange/pause/stop event handlers unchanged ...

  this._engine = engine;
  return engine;
}
```

**Update the `_adapter` field type** from `NativePlayoutAdapter | null` to `PlayoutAdapter | null`. Remove the `import { NativePlayoutAdapter } from '@dawcore/transport'` and the `import type { Transport } from '@dawcore/transport'`.

Add the PlayoutAdapter import:

```typescript
import type { PlayoutAdapter } from '@waveform-playlist/engine';
```

Note: `PlaylistEngine` is already dynamically imported in `_buildEngine()`. The `PlayoutAdapter` type import is fine as a static `import type`.

- [ ] **Step 5: Update `disconnectedCallback`**

Remove the `_ownedAudioContext?.close()` call. The adapter owns the AudioContext lifecycle.

- [ ] **Step 6: Update `bpm` setter**

The `bpm` setter calls `this._engine?.setTempo(value)`. This is fine — the engine forwards to the adapter. No change needed here.

- [ ] **Step 7: Remove `@dawcore/transport` from package.json dependencies**

In `packages/dawcore/package.json`, check if `@dawcore/transport` is in `dependencies` or `peerDependencies` and remove it. Keep `@waveform-playlist/engine` (needed for `PlayoutAdapter` type and `PlaylistEngine` dynamic import).

- [ ] **Step 8: Update existing tests that mock audioContext**

Tests that previously set `editor.audioContext = mockCtx` need to instead set `editor.adapter = { audioContext: mockCtx, ...mockAdapter }`. Search for `audioContext` in test files and update accordingly.

For the recording controller tests (`recording-controller.test.ts`), the host mock's `audioContext` property should still work since the recording controller reads `host.audioContext` — but verify the interface is satisfied.

- [ ] **Step 9: Run dawcore tests**

Run: `cd packages/dawcore && npx vitest run`
Expected: All tests pass.

- [ ] **Step 10: Run full typecheck**

Run: `pnpm typecheck`
Expected: May have failures in dawcore dev pages (fixed in Task 5). Core packages should pass.

- [ ] **Step 11: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts packages/dawcore/package.json packages/dawcore/src/__tests__/
git commit -m "feat(dawcore): make daw-editor adapter-pluggable, remove hardcoded NativePlayoutAdapter"
```

---

### Task 5: Update dawcore dev pages to explicit adapter setup

**Files:**
- Modify: `packages/dawcore/dev/index.html`
- Modify: `packages/dawcore/dev/multiclip.html`
- Modify: `packages/dawcore/dev/record.html`
- Modify: `packages/dawcore/dev/beats-grid.html`
- Modify: `packages/dawcore/dev/beat-map-grid.html`
- Modify: `packages/dawcore/dev/automation.html`
- Modify: `packages/dawcore/dev/metronome.html`
- Modify: `packages/dawcore/dev/demos.html`
- Modify: `packages/dawcore/dev/vite.config.ts` (may need alias for transport)

All dev pages currently set `editor.audioContext = new AudioContext(...)`. They need to instead create a `NativePlayoutAdapter` and set `editor.adapter`.

- [ ] **Step 1: Update multiclip.html**

Replace:
```javascript
editor.audioContext = new AudioContext({ sampleRate: 48000, latencyHint: 0 });
```

With:
```javascript
import { NativePlayoutAdapter } from '@dawcore/transport';
const audioCtx = new AudioContext({ sampleRate: 48000, latencyHint: 0 });
editor.adapter = new NativePlayoutAdapter(audioCtx);
```

Note: dev pages use `<script type="module">` so static imports work. The Vite dev server resolves workspace packages.

- [ ] **Step 2: Update index.html**

Same pattern — replace `editor.audioContext = ...` with adapter creation.

- [ ] **Step 3: Update record.html**

Same pattern.

- [ ] **Step 4: Update beats-grid.html**

This page uses `editor.transport` and `_ensureEngine()`. Replace:
```javascript
editor.audioContext = audioCtx;
await editor._ensureEngine();
const transport = editor.transport;
transport.setTempo(...);
transport.setMetronomeEnabled(true);
```

With:
```javascript
import { NativePlayoutAdapter } from '@dawcore/transport';
const adapter = new NativePlayoutAdapter(audioCtx);
editor.adapter = adapter;
await editor._ensureEngine();
adapter.transport.setTempo(...);
adapter.transport.setMetronomeEnabled(true);
```

The consumer accesses transport-specific APIs directly on their adapter reference.

- [ ] **Step 5: Update beat-map-grid.html**

Same pattern as beats-grid.html — replace `editor.transport` with `adapter.transport`.

- [ ] **Step 6: Update remaining dev pages**

Check `automation.html`, `metronome.html`, `demos.html` for any `editor.audioContext` or `editor.transport` usage and update similarly.

- [ ] **Step 7: Check vite.config.ts aliases**

In `packages/dawcore/dev/vite.config.ts`, verify `@dawcore/transport` is resolved. It may already have an alias. If not, add one:

```typescript
resolve: {
  alias: {
    '@dawcore/transport': path.resolve(__dirname, '../../transport/src/index.ts'),
    // ... existing aliases
  }
}
```

- [ ] **Step 8: Test dev pages manually**

Run: `cd packages/dawcore && pnpm dev:page`
Open: `http://localhost:5173/dev/multiclip.html`
Expected: Audio loads, plays, waveforms render. Test play/pause/stop.

- [ ] **Step 9: Commit**

```bash
git add packages/dawcore/dev/
git commit -m "refactor(dawcore): update dev pages to explicit adapter setup"
```

---

### Task 6: Update dawcore README

**Files:**
- Modify: `packages/dawcore/README.md`

- [ ] **Step 1: Update Quick Start**

Replace the current install command and basic example. The new Quick Start should show:

```bash
npm install @dawcore/components @waveform-playlist/engine @dawcore/transport
```

And the HTML/JS example should include adapter setup:

```html
<script type="module">
  import '@dawcore/components';
  import { NativePlayoutAdapter } from '@dawcore/transport';

  const editor = document.querySelector('daw-editor');
  const adapter = new NativePlayoutAdapter(new AudioContext());
  editor.adapter = adapter;
</script>
```

- [ ] **Step 2: Add "Choosing an Audio Backend" section**

After Quick Start, add a section showing both adapter options:

```markdown
## Choosing an Audio Backend

### Native Web Audio (recommended for most use cases)

No Tone.js dependency. Supports multi-tempo, multi-meter, metronome, count-in, and effects hooks.

\`\`\`bash
npm install @dawcore/transport
\`\`\`

\`\`\`javascript
import { NativePlayoutAdapter } from '@dawcore/transport';

const ctx = new AudioContext({ sampleRate: 48000 });
const adapter = new NativePlayoutAdapter(ctx);
editor.adapter = adapter;

// Transport-specific features via adapter reference
adapter.transport.setMetronomeEnabled(true);
adapter.transport.setCountIn(true);
\`\`\`

### Tone.js (effects, MIDI synths)

Uses Tone.js for audio processing. Single tempo/meter only.

\`\`\`bash
npm install @waveform-playlist/playout tone
\`\`\`

\`\`\`javascript
import { createToneAdapter } from '@waveform-playlist/playout';

const adapter = createToneAdapter();
editor.adapter = adapter;
\`\`\`
```

- [ ] **Step 3: Remove Transport Access section**

Remove the section that references `editor.transport` and `editor._ensureEngine()`. Replace with a note that transport-specific APIs are accessed on the adapter reference directly.

- [ ] **Step 4: Update Custom AudioContext section**

Remove the `editor.audioContext = ctx` pattern. AudioContext is now owned by the adapter:

```javascript
const ctx = new AudioContext({ sampleRate: 48000, latencyHint: 0 });
const adapter = new NativePlayoutAdapter(ctx);
editor.adapter = adapter;
```

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/README.md
git commit -m "docs(dawcore): update README for adapter pluggability"
```

---

### Task 7: Create dawcore + Tone.js website example

**Files:**
- Create: `website/src/pages/examples/dawcore-tone.tsx`
- Create: `website/src/components/examples/DawcoreToneExample.tsx`
- Modify: `website/src/pages/examples/index.tsx`

- [ ] **Step 1: Create the example component**

Create `website/src/components/examples/DawcoreToneExample.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';

export function DawcoreToneExample(): React.ReactElement {
  const editorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let adapter: any = null;

    async function init() {
      // Dynamic imports to avoid SSR issues — both Tone.js and dawcore
      // access browser APIs at import time
      const [{ createToneAdapter }, dawcore] = await Promise.all([
        import('@waveform-playlist/playout'),
        import('@dawcore/components'),
      ]);

      adapter = createToneAdapter();
      const editor = editorRef.current;
      if (editor) {
        (editor as any).adapter = adapter;
      }
    }

    init();

    return () => {
      if (adapter) {
        adapter.dispose();
      }
    };
  }, []);

  return (
    <div>
      {/* @ts-expect-error — custom element */}
      <daw-editor
        ref={editorRef}
        samples-per-pixel="1024"
        wave-height="80"
        timescale
        file-drop
        clip-headers
        interactive-clips
        style={{
          display: 'block',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        {/* @ts-expect-error — custom element */}
        <daw-track name="Guitars" volume="0.8">
          {/* @ts-expect-error — custom element */}
          <daw-clip
            src="/waveform-playlist/media/audio/Guitars.mp3"
            start="0"
          />
          {/* @ts-expect-error — custom element */}
        </daw-track>
        {/* @ts-expect-error — custom element */}
        <daw-track name="Drums" volume="0.8">
          {/* @ts-expect-error — custom element */}
          <daw-clip
            src="/waveform-playlist/media/audio/Drums.mp3"
            start="0"
          />
          {/* @ts-expect-error — custom element */}
        </daw-track>
        {/* @ts-expect-error — custom element */}
        <daw-transport for="editor">
          {/* @ts-expect-error — custom element */}
          <daw-play-button />
          {/* @ts-expect-error — custom element */}
          <daw-pause-button />
          {/* @ts-expect-error — custom element */}
          <daw-stop-button />
          {/* @ts-expect-error — custom element */}
        </daw-transport>
        {/* @ts-expect-error — custom element */}
      </daw-editor>
    </div>
  );
}
```

Note: The exact audio file paths and track configuration should match what's available in `website/static/media/audio/`. Check which files exist before finalizing.

- [ ] **Step 2: Create the example page**

Create `website/src/pages/examples/dawcore-tone.tsx`:

```tsx
import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyDawcoreToneExample = createLazyExample(
  () => import('../../components/examples/DawcoreToneExample').then(m => ({ default: m.DawcoreToneExample }))
);

export default function DawcoreToneExamplePage(): React.ReactElement {
  return (
    <Layout
      title="Web Components + Tone.js"
      description="dawcore web components with Tone.js audio backend"
    >
      <Head>
        <meta property="og:title" content="Web Components + Tone.js - Waveform Playlist" />
        <meta property="og:description" content="dawcore web components with Tone.js audio backend" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <main className="container margin-vert--lg">
        <h1>Web Components + Tone.js</h1>
        <p style={{ marginBottom: '2rem' }}>
          This example demonstrates using dawcore web components ({`<daw-editor>`}, {`<daw-track>`}, {`<daw-clip>`})
          with Tone.js as the audio backend via <code>createToneAdapter()</code>. The same web components
          can also use <code>NativePlayoutAdapter</code> from <code>@dawcore/transport</code> for
          a zero-dependency alternative.
        </p>

        <LazyDawcoreToneExample />

        <div style={{ marginTop: '2rem' }}>
          <h2>How It Works</h2>
          <p>
            The adapter is set on the editor before tracks load:
          </p>
          <pre style={{ background: '#1a1a2e', padding: '1rem', borderRadius: '4px', overflow: 'auto' }}>
{`import { createToneAdapter } from '@waveform-playlist/playout';

const adapter = createToneAdapter();
editor.adapter = adapter;`}
          </pre>
        </div>
      </main>
    </Layout>
  );
}
```

- [ ] **Step 3: Add to examples index**

In `website/src/pages/examples/index.tsx`, add a new entry to the `examples` array. Find an appropriate icon from `@phosphor-icons/react` (e.g., `PlugIcon` or `PuzzlePieceIcon`):

```typescript
import { PuzzlePieceIcon } from '@phosphor-icons/react';

// Add to the examples array:
{
  title: 'Web Components + Tone.js',
  description: 'Framework-free. Tone.js powered.',
  path: 'dawcore-tone',
  category: 'advanced',
  icon: <PuzzlePieceIcon weight="light" aria-hidden="true" />,
},
```

Import `PuzzlePieceIcon` at the top with the other icon imports.

- [ ] **Step 4: Check Docusaurus webpack aliases**

In `website/docusaurus.config.ts`, verify that `@dawcore/components` is in the webpack alias configuration so Docusaurus can resolve it. If not, add it — check the pattern used for other `@waveform-playlist/*` packages.

- [ ] **Step 5: Build and test**

Run: `pnpm --filter website build`
Expected: Build succeeds (CSS calc warnings are pre-existing, harmless).

Run: `pnpm --filter website start`
Open: `http://localhost:3000/waveform-playlist/examples/dawcore-tone`
Expected: Page loads, waveforms render, play/pause/stop work.

- [ ] **Step 6: Commit**

```bash
git add website/src/pages/examples/dawcore-tone.tsx website/src/components/examples/DawcoreToneExample.tsx website/src/pages/examples/index.tsx
git commit -m "feat(website): add dawcore + Tone.js example page"
```

---

### Task 8: Final verification — build, lint, typecheck

**Files:** None (verification only)

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: All packages build successfully.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: No errors. Fix any formatting issues with `pnpm format`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: Pass across all packages. If dawcore typecheck fails due to browser package, run `cd packages/dawcore && pnpm typecheck` per the feedback memory.

- [ ] **Step 4: Run all tests**

Run tests across affected packages:
```bash
cd packages/engine && npx vitest run
cd packages/playout && npx vitest run
cd packages/transport && npx vitest run
cd packages/dawcore && npx vitest run
```
Expected: All pass.

- [ ] **Step 5: Kill stray vitest processes**

Run: `pgrep -f vitest` and `pkill -f vitest` if any strays.

- [ ] **Step 6: Commit any lint/format fixes**

```bash
git add -A
git commit -m "chore: fix lint and formatting"
```
