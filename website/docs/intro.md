---
sidebar_position: 1
slug: /
description: "Multitrack Web Audio editor — choose React components or framework-agnostic Web Components."
---

# Waveform Playlist

A multitrack Web Audio editor and player with canvas waveform visualization. One headless engine, two integration paths: React components or framework-agnostic Web Components.

## What it does

- **Multitrack mixing** — Load, arrange, and mix multiple audio tracks
- **Effects** — 20 Tone.js effects with real-time parameter control (React)
- **Recording** — Mic capture with live waveform preview, multi-channel support
- **MIDI** — Load `.mid` files; piano-roll rendering; SoundFont playback
- **Spectrogram** — FFT visualization with multiple color maps
- **Annotations** — Time-synced text with drag-to-edit

## Choose your integration

### React

For React 18+ / 19+ projects. Hooks + components.

```tsx
const { tracks, loading } = useAudioTracks([{ src: '/drums.mp3' }]);
return (
  <WaveformPlaylistProvider tracks={tracks}>
    <Waveform />
  </WaveformPlaylistProvider>
);
```

[**→ Get started with React**](/docs/react/getting-started/installation)

### Web Components

For any framework or vanilla HTML. Custom elements; no React required.

```html
<daw-editor>
  <daw-track src="/drums.opus" name="Drums"></daw-track>
  <daw-track src="/bass.opus" name="Bass"></daw-track>
</daw-editor>
```

[**→ Get started with Web Components**](/docs/web-components/getting-started)

## Architecture at a glance

Both integration paths share the same headless engine (`@waveform-playlist/engine`) and a pluggable `PlayoutAdapter` for audio backends. React wraps the engine in providers + hooks; Web Components wrap it in Lit-based custom elements (`@dawcore/components`).

- [Type reference](/docs/framework-agnostic/llm-reference) — full TypeScript surface
- [Examples](/examples) — runnable demos
