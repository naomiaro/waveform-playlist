---
title: Information Architecture Restructure — React + Web Components Onboarding Split
date: 2026-05-24
status: draft
---

# IA Restructure: React + Web Components Onboarding Split

## Context

After v5.0.0 stabilization, waveform-playlist ships two parallel integration layers:

- **React** via `@waveform-playlist/browser` (the historical primary surface)
- **Web Components** via `@dawcore/*` packages (newer; framework-agnostic, no Tone.js dependency)

A four-agent doc audit (see commit `198a5023` and follow-ups) found that the docs site treats React as the canonical path and the Web Components layer as an invisible add-on. WC users land on `intro.md`, find a React quick example and a React-flavored getting-started flow, and have no signposted path forward. Feature guides (MIDI, Spectrogram, Recording) interleave React and WC code inline, forcing readers to mentally filter.

This spec proposes a new IA shape that gives both audiences a first-class onboarding journey while sharing a single framework-agnostic "Concepts" backbone.

## Goals

1. A WC user can land on the site, identify their integration in ≤10 seconds, and reach a working `<daw-editor>` in ≤10 minutes.
2. The React user's experience matches or improves on today's.
3. Framework-agnostic concept content (audio model, timing math, design rationale) lives in one place and is read by both audiences.
4. Feature guides covering both paths have clear, separate integration pages — one per framework — with shared concept underpinnings.
5. `/examples` gains a Web Components section so the agent's "WC has no showcase" complaint is closed.

## Non-Goals

- Rewriting per-package `CLAUDE.md` or `PROJECT_STRUCTURE.md` files
- Adding new product features (e.g., time-stretch — which the library does not ship)
- Adding new framework adapters (Vue, Svelte) — Framework-Agnostic stays at one page (Engine usage) for now
- Designing the implementation rollout — a separate work plan handles phasing, redirects, and per-PR slicing

## Top-Level IA

Six top-level groups (intro + five sections):

```
Intro                             ← single landing page; routes by integration

Concepts                          ← framework-agnostic; no code samples
  ├─ Overview
  ├─ Audio playlist model (clips, tracks, timeline, sample-based math)
  ├─ Playback timing (engine, transport, latency, lookahead)
  ├─ Effects routing (graph design, why Tone.js)
  ├─ Keyboard shortcuts (handleKeyboardEvent, shared shortcut model)
  ├─ MIDI rendering (ParsedMidi, piano-roll model, SoundFont)
  ├─ Spectrogram rendering (FFT, tier model, color maps)
  ├─ Recording (AudioWorklet, multi-channel, overdub)
  └─ Annotations (data model, timeline binding, edit modes)

React Integration                 ← all React code lives here
  ├─ Getting started (React)
  ├─ Provider
  ├─ Hooks
  ├─ Components
  ├─ Loading audio
  ├─ Effects
  ├─ MIDI
  ├─ Spectrogram
  ├─ Recording
  ├─ Annotations
  ├─ Theming (styled-components)
  ├─ Drag interactions
  ├─ Keyboard shortcuts
  ├─ Beats & Bars
  └─ Media Element variant

Web Components Integration        ← all WC code lives here
  ├─ Getting started (WC)
  ├─ Editor element (<daw-editor>)
  ├─ Track & clip elements
  ├─ Visual elements (waveform, playhead, ruler, piano-roll)
  ├─ Transport elements
  ├─ Track controls (<daw-track-controls>)
  ├─ Selection (<daw-selection>)
  ├─ Loading audio
  ├─ Recording (<daw-record-button>, RecordingController)
  ├─ Clip interactions (drag, trim, split via ClipPointerHandler)
  ├─ Keyboard shortcuts (<daw-keyboard-shortcuts>)
  ├─ Grid / beats & bars (<daw-grid>)
  ├─ MIDI
  ├─ Spectrogram
  ├─ Audio graph taps (masterOutputNode → analyser/recorder/Tone chains)
  ├─ Theming (CSS custom properties)
  └─ Tone.js bridge

Framework-Agnostic
  └─ Engine direct usage (Vue, Svelte, vanilla JS)

API Reference                     ← canonical; generated where possible
  ├─ Hooks API
  ├─ Components API
  ├─ Elements API
  └─ LLM Reference (existing `llm-reference.md`)
```

## Section Contents

### Intro (`intro.md`)

Single landing page. Top-down structure:

1. **Hero** — Name, tagline, two primary CTAs: `[ Get the package ]` and `[ See examples ]`.
2. **Features grid** — 6 callouts: Multitrack mixing · Effects · Recording · MIDI · Spectrogram · Annotations. Each is a card with an icon, one-line description, and link to its Concepts page.
3. **Choose your integration** — Two cards:
   - **React** — "React 18+/19+ projects. Hooks + components. `useAudioTracks(...)`" → `/docs/react/getting-started`
   - **Web Components** — "Any framework or vanilla JS. `<daw-editor>` custom elements." → `/docs/web-components/getting-started`
4. **Architecture at a glance** — Collapsible single-screen diagram + paragraph showing the Engine + PlayoutAdapter model; useful for evaluators deciding if the architecture fits their stack.
5. **Footer** — Link to `/examples`, GitHub repo, supported browsers.

### Concepts/

Framework-agnostic; **no code samples**. Nine pages:

| Page | Covers |
|---|---|
| `overview.md` | What the library is, who it's for, the Engine + Adapter architecture |
| `audio-playlist-model.md` | `ClipTrack`, `AudioClip`, timeline, sample-based math, `startTick` vs `startSample` |
| `playback-timing.md` | Engine ownership of time, Transport, `outputLatency`, lookahead, the `visualTime` vs raw time distinction |
| `effects-routing.md` | Tone.js graph design, per-track vs master chains, why we use Tone.js, offline render |
| `keyboard-shortcuts.md` | The shared `handleKeyboardEvent` model and `KeyboardShortcut` type from `@waveform-playlist/core` (per PR #343). Both integration pages reference this for the underlying contract; integration pages then cover their framework-specific wiring (`KeyboardShortcuts` component for React, `<daw-keyboard-shortcuts>` element for WC). |
| `midi-rendering.md` | `ParsedMidi` type, `MidiNoteData`, piano-roll model, SoundFont loading concepts |
| `spectrogram-rendering.md` | FFT pipeline, color maps, 3-tier render strategy, viewport orchestrator |
| `recording.md` | AudioWorklet capture pipeline, multi-channel handling, overdub semantics, latency compensation |
| `annotations.md` | `AnnotationData` schema, timeline binding, continuous-play and link-endpoints behaviors |

### React Integration/

All React code; all examples copy-pasteable. Fifteen pages:

| Page | Covers |
|---|---|
| `getting-started.md` | Install, first playlist, common pitfalls (StrictMode, AudioContext init, `deferEngineRebuild`) |
| `provider.md` | `WaveformPlaylistProvider` props, lifecycle, `onTracksChange` contract |
| `hooks.md` | The four context hooks: `usePlaybackAnimation`, `usePlaylistState`, `usePlaylistControls`, `usePlaylistData` |
| `components.md` | `Waveform`, transport buttons, controls, `KeyboardShortcuts`, `ClipInteractionProvider` |
| `loading-audio.md` | `useAudioTracks`, `useDynamicTracks`, file-drop pattern with `decodeAudioFiles` |
| `effects.md` | `useDynamicEffects`, `useTrackDynamicEffects`, effect categories, runtime parameter updates |
| `midi.md` | `useMidiTracks`, SoundFont loading via `soundFontCache` prop |
| `spectrogram.md` | `SpectrogramProvider`, settings modal, integration with `SpectrogramIntegrationContext` |
| `recording.md` | `useIntegratedRecording`, mic permission flow, multi-channel, VU metering |
| `annotations.md` | `useAnnotationControls`, edit modes, keyboard navigation |
| `theming.md` | `styled-components` theme tokens, custom Channel components |
| `drag-interactions.md` | `ClipInteractionProvider`, modifiers (collision, snap-to-grid), custom drag setup |
| `keyboard-shortcuts.md` | `KeyboardShortcuts` component, `useKeyboardShortcuts` for custom bindings. Builds on the shared model documented in `Concepts/keyboard-shortcuts.md`. |
| `beats-and-bars.md` | `BeatsAndBarsProvider`, musical time, snap modes. Parallel to WC's `grid.md`. |
| `media-element-variant.md` | `MediaElementPlaylistProvider` for single-track HTMLAudioElement playback (language learning, podcasts) |

### Web Components Integration/

All WC code. Seventeen pages — near-parity with React:

| Page | Covers |
|---|---|
| `getting-started.md` | Install via npm or CDN, minimal `<daw-editor>` page, common pitfalls (PlayoutAdapter requirement, AudioContext init) |
| `editor-element.md` | `<daw-editor>` attributes, properties, events, lifecycle |
| `track-and-clip.md` | `<daw-track>`, `<daw-clip>` data elements (light DOM), MutationObserver lifecycle |
| `visual-elements.md` | `<daw-waveform>`, `<daw-playhead>`, `<daw-ruler>`, `<daw-piano-roll>` — shadow DOM, chunked canvas (`<daw-grid>` has its own page below given React's `beats-and-bars.md` is dedicated) |
| `transport-elements.md` | `<daw-transport>`, play/pause/stop buttons, `<daw-transport-button>`, transport binding via `for` attribute |
| `track-controls.md` | `<daw-track-controls>` — per-track volume/mute/solo/pan UI |
| `selection.md` | `<daw-selection>` element, selection model |
| `loading-audio.md` | File drops, programmatic `editor.addTrack`, peaks pre-computation |
| `recording.md` | `<daw-record-button>`, `RecordingController`, `daw-recording-*` events (start/complete/error/pause/resume) |
| `clip-interactions.md` | `ClipPointerHandler`, `splitAtPlayhead`, drag/trim/split semantics, pointer engine contract |
| `keyboard-shortcuts.md` | `<daw-keyboard-shortcuts>` element, configurable `shortcuts` property (per PR #343). Builds on the shared model documented in `Concepts/keyboard-shortcuts.md`. |
| `grid.md` | `<daw-grid>` element — beats/bars rendering, BPM + time signature inputs, snap modes. Parallel to React's `beats-and-bars.md`. |
| `midi.md` | `editor.loadMidi(source, options?)`, optional `@dawcore/midi` peer dep |
| `spectrogram.md` | `<daw-spectrogram>`, `SpectrogramController` |
| `audio-graph-taps.md` | The `adapter.masterOutputNode` tap pattern — exposed by both `NativePlayoutAdapter` and `TonePlayoutAdapter` as the documented escape hatch for connecting arbitrary AudioNodes (analysers, recorders, custom worklets, Tone effect chains). Covers connection, cleanup, and worked examples from `examples/dawcore-{native,tone}/analyser.html`. **Forward-looking:** when per-track taps land, this page extends to cover them — no rename needed. |
| `theming.md` | CSS custom properties, dark-mode handling |
| `tone-bridge.md` | Using `TonePlayoutAdapter` for Tone.js effects with the WC stack. For the master-output tap mechanic itself, see `audio-graph-taps.md`; this page covers Tone-specific concerns: lazy import, context bridging via `setContext`, the `getGlobalContext` gotcha, and end-to-end recipes for applying Tone effect chains to the entire playlist. |

Pages **deliberately not present** in WC integration:

- **Effects** — no dedicated WC effects API yet. The current path is to chain Tone effects manually via the master-output tap (`audio-graph-taps.md` covers the mechanic; `tone-bridge.md` covers the Tone-specific recipe). A dedicated `effects.md` would land if/when WC gains an effects abstraction.
- **Annotations** — no WC element/controller exists today; concept lives in `Concepts/annotations.md`.
- **Media Element variant** — `MediaElementPlaylistProvider` has no WC equivalent; if one ever ships, it gets its own page.

### Framework-Agnostic/

| Page | Covers |
|---|---|
| `engine.md` | `PlaylistEngine`, `PlayoutAdapter` interface, when to bypass providers, Vue/Svelte/vanilla-JS recipes |

One page for now. Will grow into a section if Vue/Svelte wrappers materialize.

### API Reference/

| Page | Covers |
|---|---|
| `hooks-api.md` | React hooks reference (auto-generated from source where possible) |
| `components-api.md` | React component reference |
| `elements-api.md` | Web Components element reference (attributes/properties/events tables) |
| `llm-reference.md` | Existing all-types page; kept as the single canonical TypeScript dump |

## Examples Reorganization

`/examples` landing page gains three sections, in this order:

| Section | Contents | Ports needed |
|---|---|---|
| **React** | 19 existing example pages | None |
| **Web Components** | Ported from `examples/dawcore-native` (10 pages: basic, multiclip, programmatic, record, spectrogram, beats-grid, beat-map-grid, metronome, automation, analyser) and `examples/dawcore-tone` (Tone.js variants: basic, multiclip, record, spectrogram, beats-grid, programmatic, midi, midi-load, analyser). De-duplicate where pairs cover the same feature with both native + Tone.js adapters — show one page per feature with an adapter toggle. **Open question (see below):** which subset to port in the first wave. | ~8–12 new pages |
| **Engine** | Placeholder (one paragraph: "Direct engine usage examples — coming when there's demand. See the Engine guide for the API.") | None |

Each example card gets a small framework badge (React / WC / Engine). The `/examples` landing page (`website/src/pages/examples/index.tsx`) is a custom React page (not a Docusaurus doc sidebar) — the three sections render as headed groups within the grid, with an in-page filter rail at the top for quick framework filtering.

WC examples are built as Docusaurus-native React pages (matching the existing pattern) that render the WC elements directly. This requires source-aliasing `@dawcore/components`, `@dawcore/transport`, and `@dawcore/midi` in `website/docusaurus.config.ts` alongside the existing `@waveform-playlist/*` aliases.

**Standalone Vite apps stay.** `examples/dawcore-native/` and `examples/dawcore-tone/` continue to exist as runnable quick-start scaffolds — clone the repo, run `pnpm example:dawcore-native` or `pnpm example:dawcore-tone`, see it work locally. The website ports listed above are additions, not replacements: the Vite apps give developers a complete copy-pasteable starting point; the website pages give visitors an in-browser showcase. Each website example page should link to its corresponding standalone app for users who want the local-dev experience.

## Judgment Calls (call out for review)

These are placements I made without dedicated user input — flagging for confirmation:

1. **Theming is in both integration sections** — same conceptual idea, very different implementation (`styled-components` themes vs CSS custom properties). Felt cleaner than one Concepts page + dual implementation pages.

2. **Clip interactions has parallel pages in both sections** — React has `drag-interactions.md` (`ClipInteractionProvider`, modifiers); WC has `clip-interactions.md` (`ClipPointerHandler`, `splitAtPlayhead`). Same conceptual surface, very different APIs.

3. **Keyboard shortcuts has parallel pages in both sections** — React: `KeyboardShortcuts` component + `useKeyboardShortcuts`. WC: `<daw-keyboard-shortcuts>` element + `shortcuts` property (per PR #343). The shared keyboard model lives in `Concepts` (or could fold into existing concepts — flag for review).

4. **Media Element variant is React-only** — `MediaElementPlaylistProvider` is a React-specific provider for single-track HTMLAudioElement playback. No WC equivalent exists; if one ever does, it gets its own page in WC integration.

5. **VU meters fold into the Recording integration pages** — the agent flagged VU as a missing example, not a missing guide. `Concepts/recording.md` covers the VU concept; integration pages show wiring.

6. **"Custom drag setup" folds into the React `drag-interactions.md`** — same content; doesn't need a separate page in the new IA.

7. **Beats & Bars has parallel pages in both sections** — React has `BeatsAndBarsProvider` (a Provider), WC has `<daw-grid>` (an element). Both pages cover the same conceptual surface (BPM, time signature, snap modes); the conceptual model (PPQN, tempo map) lives in `Concepts/playback-timing.md`.

8. **Effects has no dedicated WC integration page — workaround is split into two pages** — there's no `daw-effects-*` surface in dawcore today, so React's `effects.md` (covering `useDynamicEffects`) has no direct WC counterpart. The working manual path is split across two pages: `audio-graph-taps.md` covers the underlying `adapter.masterOutputNode` mechanic (also used by analysers, recorders, custom worklets); `tone-bridge.md` covers the Tone-specific recipe (lazy import, context bridging, effect chain construction). `Concepts/effects-routing.md` covers the design rationale shared by both React and WC.

## Migration Considerations (high-level only)

Detailed phasing belongs to a separate work plan. The plan must honor these constraints:

- **Existing URLs redirect, not 404.** Docusaurus's client-side redirects plugin maps old → new (`/docs/getting-started/installation` → `/docs/react/getting-started`, `/docs/guides/midi` → `/docs/concepts/midi-rendering` or `/docs/react/midi`, etc.).
- **Examples URLs stay stable.** Example slugs don't change; only the index-page UI changes.
- **`sidebars.ts` rewrites in one PR.** Content moves can be phased.
- **`llms.txt` and `llm-reference.md` update once** the new structure ships, not incrementally.
- **One PR per section is the working unit.** Top-level scaffolding (sidebar + intro) → Concepts → React Integration → WC Integration → Framework-Agnostic + Examples → cleanup of old URLs.

## Out of Scope / Deferred

- Vue, Svelte, Alpine wrappers
- Versioned docs (Docusaurus supports it; no current need)
- i18n
- Per-framework search-result re-ranking (could come later if the split muddies search)
- Auto-generating the API Reference pages from TypeScript source (worth its own spec)
- Migrating per-package `CLAUDE.md` content into user-facing docs

## Open Questions for Review

1. **Concepts (9) + React Integration (15) + WC Integration (17) page counts** — does this feel right? Anything missing or over-split?
2. **Landing features grid (6: Multitrack mixing, Effects, Recording, MIDI, Spectrogram, Annotations)** — right ones to lead with?
3. **Migration constraint priority** — "redirects, not 404s" is treated as priority over a clean cutover. Confirm?
4. **WC examples — first wave port subset.** There are ~10 example HTML pages in `examples/dawcore-native` and ~9 in `examples/dawcore-tone`. Suggested starter set: basic, multiclip, record, spectrogram, midi, beats-grid (6 pages, both native + Tone variants merged via adapter toggle). Or wider/narrower?
