---
sidebar_position: 1
description: "Quick-start guide for @dawcore/components — install, set up, render your first multitrack editor."
---

# Getting Started with Web Components

`@dawcore/components` ships framework-agnostic Web Components for multi-track audio editing. Drop `<daw-editor>` into any HTML page — no React, no build step required.

## Installation

```bash
npm install @dawcore/components
```

Peer dependencies:

```bash
npm install @waveform-playlist/core @waveform-playlist/engine
```

Audio backend — choose one:

```bash
npm install @dawcore/transport          # Native Web Audio (recommended)
# or
npm install @waveform-playlist/playout tone  # Tone.js (required for MIDI playback today)
```

Optional (for recording):

```bash
npm install @waveform-playlist/worklets
```

## Minimal setup

```html
<script type="module">
  import '@dawcore/components';
  import { NativePlayoutAdapter } from '@dawcore/transport';

  const editor = document.querySelector('daw-editor');
  editor.adapter = new NativePlayoutAdapter(new AudioContext());
</script>

<daw-editor id="editor" samples-per-pixel="1024" wave-height="100" timescale>
  <daw-track src="/audio/drums.opus" name="Drums"></daw-track>
  <daw-track src="/audio/bass.opus" name="Bass"></daw-track>
  <daw-track src="/audio/synth.opus" name="Synth"></daw-track>
</daw-editor>

<daw-transport for="editor">
  <daw-play-button></daw-play-button>
  <daw-pause-button></daw-pause-button>
  <daw-stop-button></daw-stop-button>
</daw-transport>
```

The editor loads audio, generates waveforms, and handles playback.

## Important: AudioContext + adapter are required

`<daw-editor>` does **not** create an `AudioContext` for you. You must:

1. Create an `AudioContext` (`new AudioContext()` or `new AudioContext({ sampleRate: 48000 })`)
2. Instantiate a `PlayoutAdapter` (e.g., `NativePlayoutAdapter` from `@dawcore/transport`)
3. Assign it to `editor.adapter`

This is intentional — it lets consumers choose their audio backend (native Web Audio or Tone.js) and keeps `AudioContext` lifecycle in your hands.

## Try it locally

Two runnable starter apps live in the repo:

```bash
git clone https://github.com/naomiaro/waveform-playlist.git
cd waveform-playlist
pnpm install
pnpm example:dawcore-native    # Native Web Audio backend
pnpm example:dawcore-tone      # Tone.js backend
```

Each starter has multiple example pages — basic, multiclip, recording, spectrogram, MIDI, beats grid, metronome — you can use as a starting point.

## Next steps

For the complete element catalog, audio-backend comparison, MIDI loading, recording reference, and CSS theming, see the [`@dawcore/components` README](https://github.com/naomiaro/waveform-playlist/blob/main/packages/dawcore/README.md).

Using React instead? → [React Getting Started](/docs/react/getting-started/installation)
