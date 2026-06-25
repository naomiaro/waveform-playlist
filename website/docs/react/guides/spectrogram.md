---
sidebar_position: 11
description: "FFT spectrogram visualization for tracks — color maps, frequency scales, and both React and Web Components paths"
---

# Spectrogram Visualization

Waveform Playlist can render tracks as FFT spectrograms — color-mapped time-frequency plots derived from the audio. Two flavors:

- **React** — the `@waveform-playlist/spectrogram` package provides `<SpectrogramProvider>` (plus optional menu / modal UI) that wraps `<WaveformPlaylistProvider>`.
- **Web Components** — `<daw-track render-mode="spectrogram">` on `<daw-editor>`, backed by `@dawcore/spectrogram`.

Both paths share the same framework-agnostic computation, Web Worker, and `SpectrogramOrchestrator` (viewport-aware chunked rendering, generation-based abort, color LUT cache) — the React Provider and the dawcore Lit elements are both thin layers on top.

## React

### Installation

```bash
npm install @waveform-playlist/spectrogram
```

`@dawcore/spectrogram` (which carries the FFT, worker, and orchestrator) is a regular dependency and will be installed automatically.

### Basic Usage

Wrap your editor with `<SpectrogramProvider>` and set a track's `renderMode`:

```tsx
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import { useAudioTracks } from '@waveform-playlist/browser/tone';
import { SpectrogramProvider } from '@waveform-playlist/spectrogram';

function MyEditor() {
  const { tracks, loading } = useAudioTracks([
    { src: '/audio/vocals.opus', name: 'Vocals', renderMode: 'spectrogram' },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks}>
      <SpectrogramProvider config={{ fftSize: 2048, frequencyScale: 'mel' }} colorMap="viridis">
        <Waveform />
      </SpectrogramProvider>
    </WaveformPlaylistProvider>
  );
}
```

The provider exposes one config + one color map at a time. Per-track overrides come from the track's own `spectrogramConfig` / `spectrogramColorMap` fields.

### Render Modes

Each track has a `renderMode` field:

| Mode | Renders |
|---|---|
| `'waveform'` (default) | Time-domain waveform |
| `'spectrogram'` | FFT spectrogram only |
| `'both'` | Waveform on top, spectrogram below |
| `'piano-roll'` | MIDI notes (for clips with `midiNotes`) |

### Optional UI

The package also exports drop-in UI components for tweaking spectrogram settings at runtime:

- `<SpectrogramMenuItems />` — render mode + color map menu items, easily slotted into a `TrackContextMenu`
- `<SpectrogramSettingsModal />` — full settings panel covering FFT size, frequency scale, gain, range, etc.

Both are framework-aware: they read selection state from `WaveformPlaylistProvider` and update the per-track overrides via the integration context.

## Web Components

### Installation

```bash
npm install @dawcore/components
```

`@dawcore/spectrogram` is a regular dependency — no extra install needed.

### Declarative Usage

```html
<daw-editor id="editor">
  <daw-track src="/audio/vocals.opus" name="Vocals" render-mode="spectrogram"></daw-track>
</daw-editor>

<script type="module">
  import '@dawcore/components';
  import { NativePlayoutAdapter } from '@dawcore/transport';

  const editor = document.getElementById('editor');
  editor.adapter = new NativePlayoutAdapter(new AudioContext());

  // Global defaults for every spectrogram track
  editor.spectrogramConfig = { fftSize: 2048, frequencyScale: 'mel' };
  editor.spectrogramColorMap = 'magma';
</script>
```

The spectrogram worker pool is created lazily on the first track that uses `render-mode="spectrogram"` (or `"both"`) and torn down when no spectrogram tracks remain. No consumer-facing pool API.

### Per-Track Overrides

Set `spectrogramConfig` on an individual `<daw-track>` to override the editor-wide defaults for that track only:

```javascript
const track = editor.querySelector('daw-track');
track.spectrogramConfig = { colorMap: 'magma', minFrequency: 80, maxFrequency: 8000 };
```

Reset by assigning `null`:

```javascript
track.spectrogramConfig = null;  // falls back to editor defaults
```

### Runtime Mode Switching

`renderMode` is a reflected attribute — flip it any time:

```javascript
track.renderMode = 'both';
// or
track.setAttribute('render-mode', 'spectrogram');
```

### `daw-spectrogram-ready` event

Fires (bubbling, composed) when the viewport-tier FFT completes for a track. Useful for E2E tests and screenshot tooling.

```javascript
editor.addEventListener('daw-spectrogram-ready', (e) => {
  console.log('Spectrogram ready for track:', e.detail.trackId);
});
```

## SpectrogramConfig

Both paths accept the same config shape (from `@waveform-playlist/core`):

```typescript
interface SpectrogramConfig {
  fftSize?: 256 | 512 | 1024 | 2048 | 4096 | 8192;  // Default: 2048
  hopSize?: number;                                   // Default: fftSize / 4
  windowFunction?: 'hann' | 'hamming' | 'blackman' | 'rectangular' | 'bartlett' | 'blackman-harris';  // Default: 'hann'
  alpha?: number;                                     // Window-function parameter (0-1)
  frequencyScale?: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb';  // Default: 'mel'
  minFrequency?: number;                              // Default: 0
  maxFrequency?: number;                              // Default: sampleRate / 2
  gainDb?: number;                                    // Display brightness boost. Default: 20
  rangeDb?: number;                                   // Signal range. Default: 80
  zeroPaddingFactor?: number;                         // FFT length multiplier. Default: 2
  labels?: boolean;                                   // Frequency axis labels
  labelsColor?: string;
  labelsBackground?: string;
}
```

**`colorMap` is NOT inside `SpectrogramConfig`** — it's a separate prop on `<SpectrogramProvider>` (React) or a separate property `editor.spectrogramColorMap` / `track.spectrogramColorMap` (Web Components). Mixing it into `SpectrogramConfig` will fail typecheck.

## Color Maps

Six built-in maps available as string names:

```typescript
type ColorMapName = 'viridis' | 'magma' | 'inferno' | 'grayscale' | 'igray' | 'roseus';
```

### Custom Color Maps

Pass an array of `[r, g, b]` or `[r, g, b, a]` entries (values 0-255) for a custom palette:

```typescript
const fire = [
  [0, 0, 0],         // black (silence)
  [128, 0, 0],       // dark red
  [255, 64, 0],      // orange
  [255, 200, 0],     // yellow
  [255, 255, 255],   // white (peak)
];

// React
<SpectrogramProvider colorMap={fire}>...</SpectrogramProvider>

// Web Components
editor.spectrogramColorMap = fire;
```

The orchestrator builds a lookup table from the array once and caches it; runtime cost is identical to a named preset.

## Frequency Scales

Five scales available — `'mel'` is the default and best-suited for most audio:

| Scale | Use case |
|---|---|
| `'linear'` | Equal Hz spacing — best for inspecting harmonic structure |
| `'logarithmic'` | Pitch-perceptual spacing (octaves get equal screen height) |
| `'mel'` | Mel scale — perceptual scale for vocals and music |
| `'bark'` | Bark scale — psychoacoustic, similar to mel |
| `'erb'` | Equivalent Rectangular Bandwidth — cochlear-perception based |

The scale only affects rendering; the underlying FFT is the same. Switching scales reuses the cached FFT data — no recompute.

## Pre-Computed Peaks Caveat

Spectrograms need the actual `AudioBuffer` (not pre-computed `.dat` peaks). If you load audio via `peaks-src` attribute (pre-computed peaks), the spectrogram won't render until the audio decode completes in the background. This is the same trade-off as recording's live preview.

## Performance Notes

- **Worker pool** sized by `navigator.hardwareConcurrency` — multiple tracks render in parallel.
- **Viewport-aware rendering** — only visible chunks compute FFT; off-screen chunks defer until scrolled into view.
- **Generation-based abort** — zoom or config changes cancel in-flight FFT work for the old generation.
- **Color LUT cache** — `[r, g, b]` lookup table built once per color map; reused across all tracks.
- **Chunked canvases** — 1000px-wide canvas chunks (matches the waveform renderer) so large timelines stay responsive.
