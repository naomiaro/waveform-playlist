# Design: `<daw-editor>` Adapter Pluggability

**Issue:** [#378](https://github.com/naomiaro/waveform-playlist/issues/378) — `<daw-editor />` and PlayoutAdapter
**Date:** 2026-04-25

## Problem

`<daw-editor>` hardcodes `NativePlayoutAdapter` from `@dawcore/transport` in `_buildEngine()`. Consumers who want to use Tone.js (for effects, MIDI synths) with dawcore web components have no way to plug in a different audio backend. The `PlayoutAdapter` interface in `@waveform-playlist/engine` already defines the contract — `<daw-editor>` just doesn't expose it.

## Goals

1. Make `<daw-editor>` adapter-agnostic — consumers provide their own `PlayoutAdapter` instance
2. Add single-tempo/meter support to `TonePlayoutAdapter` so it works with dawcore's BPM/meter features
3. Keep Tone.js out of default dawcore examples (bundle size)
4. Demonstrate both adapter options with website examples

## Non-Goals

- Multi-tempo or multi-meter support in `TonePlayoutAdapter` (throw on `atTick` usage)
- Changing `NativePlayoutAdapter`'s API
- Adding dawcore-specific features to `TonePlayoutAdapter` (metronome, count-in, effects hooks)

## Design

### 1. `<daw-editor>` Adapter Property

**Remove the hardcoded adapter.** Add a required `adapter` JS property. No default is created. If a consumer calls `play()` or triggers engine creation without setting an adapter, throw a clear error with install instructions.

```typescript
// New property on <daw-editor>
@property({ attribute: false })
set adapter(value: PlayoutAdapter | null) {
  this._externalAdapter = value;
}
get adapter(): PlayoutAdapter | null {
  return this._externalAdapter;
}
```

**Error when missing:**

```
Error: No PlayoutAdapter set on <daw-editor>.
Install an adapter and set it before use:

  // Option 1: Native Web Audio (no Tone.js)
  npm install @dawcore/transport
  import { NativePlayoutAdapter } from '@dawcore/transport';
  editor.adapter = new NativePlayoutAdapter(editor.audioContext);

  // Option 2: Tone.js (effects, MIDI synths)
  npm install @waveform-playlist/playout
  import { createToneAdapter } from '@waveform-playlist/playout';
  editor.adapter = createToneAdapter();
```

**Changes to `_buildEngine()`:**

```typescript
private async _buildEngine() {
  if (!this._externalAdapter) {
    throw new Error(/* install instructions above */);
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
    ppqn: this._ppqn,
    zoomLevels: [256, 512, 1024, 2048, 4096, 8192, this.samplesPerPixel]
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a - b),
  });
  // ... rest unchanged
}
```

**Remove `transport` getter.** Consumers already hold the adapter reference — no need for the editor to expose it back. This decouples `<daw-editor>` from any specific adapter implementation.

**Dependency changes:**
- Remove `@dawcore/transport` from `@dawcore/components` dependencies
- `@waveform-playlist/engine` remains a dependency (for `PlaylistEngine`)

### 2. `TonePlayoutAdapter` — Tempo/Meter Methods

Add 4 methods to `TonePlayoutAdapter` with single-tempo/meter semantics. Throw on multi-tempo/meter usage (`atTick` parameter).

```typescript
// In TonePlayoutAdapter class

private _bpm: number = 120;
private _ppqn: number = 960;
private _numerator: number = 4;
private _denominator: number = 4;

setTempo(bpm: number, atTick?: number): void {
  if (atTick !== undefined) {
    throw new Error(
      'Multiple tempo changes not supported by TonePlayoutAdapter. ' +
      'Use NativePlayoutAdapter from @dawcore/transport for multi-tempo support.'
    );
  }
  this._bpm = bpm;
  // Update Tone.js Transport BPM
  this._transport.bpm.value = bpm;
}

setMeter(numerator: number, denominator: number, atTick?: number): void {
  if (atTick !== undefined) {
    throw new Error(
      'Multiple meter changes not supported by TonePlayoutAdapter. ' +
      'Use NativePlayoutAdapter from @dawcore/transport for multi-meter support.'
    );
  }
  this._numerator = numerator;
  this._denominator = denominator;
  this._transport.timeSignature = [numerator, denominator];
}

ticksToSeconds(tick: number): number {
  return (tick * 60) / (this._bpm * this._ppqn);
}

secondsToTicks(seconds: number): number {
  return (seconds * this._bpm * this._ppqn) / 60;
}
```

**PPQ alignment:** `TonePlayoutAdapter` must accept a `ppqn` option (default 960, matching dawcore). Tone.js Transport defaults to PPQ=192. The adapter's `ticksToSeconds`/`secondsToTicks` use the adapter's own `_ppqn` for conversion math — this is independent of Tone.js Transport's internal PPQ.

### 3. dawcore README Update

Update `packages/dawcore/README.md`:

- **Quick Start:** Show adapter setup as a required step. Both options (NativePlayoutAdapter and TonePlayoutAdapter) with install commands.
- **Remove `transport` getter references.** Replace with direct adapter usage pattern.
- **Transport-specific features section:** Clarify that metronome, count-in, effects hooks are `NativePlayoutAdapter`-specific. Consumer accesses these on their own adapter reference.

### 4. Website Examples

**New example page:** `website/src/pages/examples/dawcore-tone.tsx`
- dawcore web components (`<daw-editor>`, `<daw-track>`, `<daw-clip>`) with `TonePlayoutAdapter`
- Multi-clip demo content (same audio files as existing multi-clip example)
- Shows the adapter wiring pattern: `createToneAdapter()` → `editor.adapter = adapter`
- Listed in examples index under a new `'web-components'` category

**New example component:** `website/src/components/examples/DawcoreToneExample.tsx`
- React wrapper that renders dawcore web components (they work in any DOM environment)
- Uses `createLazyExample` for SSR safety (Tone.js accesses `window` at import time)
- Playback controls via native `<daw-transport>` buttons or custom JS

**Existing dawcore dev page:** Update `packages/dawcore/dev/` to use explicit `NativePlayoutAdapter` setup (no longer auto-imported by `<daw-editor>`).

## Breaking Changes

All in `@dawcore/components` (currently 0.0.x, pre-1.0):

1. **`adapter` property required** — consumers must set it before use
2. **`transport` getter removed** — use adapter reference directly
3. **`@dawcore/transport` no longer auto-installed** — add it explicitly if using `NativePlayoutAdapter`

## Migration

Before:
```html
<script type="module">
  import '@dawcore/components';
  // Just works — NativePlayoutAdapter created internally
</script>
```

After:
```html
<script type="module">
  import '@dawcore/components';
  import { NativePlayoutAdapter } from '@dawcore/transport';

  const editor = document.querySelector('daw-editor');
  editor.adapter = new NativePlayoutAdapter(editor.audioContext);
</script>
```

## Testing

- **`<daw-editor>` unit tests:** Verify error thrown when no adapter set. Verify adapter methods called correctly (`setTempo`, `setMeter`).
- **`TonePlayoutAdapter` unit tests:** Verify `setTempo`/`setMeter` with single values. Verify throws on `atTick`. Verify `ticksToSeconds`/`secondsToTicks` math.
- **E2E:** dawcore-tone example loads and plays audio correctly.
- **Existing tests:** Update any dawcore tests that rely on auto-created adapter.

## File Changes Summary

| File | Change |
|------|--------|
| `packages/dawcore/src/elements/daw-editor.ts` | Add `adapter` property, remove `transport` getter, update `_buildEngine()`, remove `@dawcore/transport` import |
| `packages/dawcore/package.json` | Remove `@dawcore/transport` from dependencies |
| `packages/playout/src/TonePlayoutAdapter.ts` | Add `setTempo`, `setMeter`, `ticksToSeconds`, `secondsToTicks` |
| `packages/dawcore/README.md` | Update Quick Start, adapter setup, remove transport getter docs |
| `packages/dawcore/dev/` | Update dev page to explicit adapter setup |
| `packages/dawcore/src/__tests__/` | Update tests for new adapter requirement |
| `website/src/pages/examples/dawcore-tone.tsx` | New example page |
| `website/src/components/examples/DawcoreToneExample.tsx` | New example component |
| `website/src/pages/examples/index.tsx` | Add dawcore-tone to examples list |
