---
sidebar_position: 16
description: "Compose the waveform view from its parts: timescale, track controls, tracks, clip headers, fades, annotation boxes, selection and playhead"
---

# Composing the View

The waveform view is made of parts. Each thing it draws (the time ruler, the track controls, the tracks, the playhead) is a component, and it is drawn because you render it inside a root. There are no props that switch a part on or off.

Three compositions are ready-made. Use one when it fits, and write your own when it does not.

## Ready-Made Compositions

| Component | Provider | Is |
| --- | --- | --- |
| `<Waveform />` | `WaveformPlaylistProvider` | timescale, loop region, track controls (a 200 px column), tracks, annotation boxes, selection, playhead; the annotation text list below when there are annotations |
| `<WaveformEditor />` | `WaveformPlaylistProvider` | `<Waveform />` with clip headers and fade curves |
| `<MediaElementWaveform />` | `MediaElementPlaylistProvider` | timescale, the one track, annotation boxes, selection, playhead; the annotation text list below when there are annotations |

They take `className` and their annotation options, and nothing about what is drawn. See the [Components reference](/docs/react/api/components#the-view-roots-parts-and-ready-made-compositions) for the props.

```tsx
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';

<WaveformPlaylistProvider tracks={tracks}>
  <Waveform />
</WaveformPlaylistProvider>
```

## The Parts

| Part | Draws | Options | Provider |
| --- | --- | --- | --- |
| `WaveformRoot` | the frame: the scrolling area and the places the parts go to | `className` | `WaveformPlaylistProvider` |
| `MediaElementWaveformRoot` | the same for the MediaElement player | `className` | `MediaElementPlaylistProvider` |
| `WaveformTimescale` | the time ruler, in a strip above the tracks | `renderTick` | either |
| `WaveformLoopRegion` | the draggable loop region, in the same strip | none | `WaveformPlaylistProvider` |
| `WaveformTrackControls` | the column of track controls, left of the scrolling area | `width` (pixels, default 200), `renderTrackControls`, `onRemoveTrack`, `trackReordering` | `WaveformPlaylistProvider` |
| `WaveformTracks` | the track rows with their clips | `gainScaled`; children: the three below | either |
| `WaveformClipHeaders` | a header on every clip | none | either |
| `WaveformFades` | each clip's fade-in and fade-out curves | none | either |
| `WaveformRecordingPreview` | the take being recorded, in its track | `recordingState` | `WaveformPlaylistProvider` |
| `WaveformAnnotationBoxes` | the row of annotation boxes | `getAnnotationBoxLabel` | `WaveformPlaylistProvider` |
| `MediaElementAnnotationBoxes` | the same for the MediaElement player, with its edge drag | `getAnnotationBoxLabel`, `editable`, `linkEndpoints`, `onAnnotationUpdate` | `MediaElementPlaylistProvider` |
| `WaveformSelection` | the highlighted selection | none | either |
| `WaveformPlayhead` | the playhead | `renderPlayhead` | either |

All are exported from `@waveform-playlist/browser`.

## A Composition

This is what `<Waveform />` renders. Start from it and change what you need:

```tsx
import {
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformAnnotationBoxes,
  WaveformSelection,
  WaveformPlayhead,
  PlaylistAnnotationList,
} from '@waveform-playlist/browser';

<WaveformRoot>
  <WaveformTimescale />
  <WaveformLoopRegion />
  <WaveformTrackControls />
  <WaveformTracks />
  <WaveformAnnotationBoxes />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
<PlaylistAnnotationList />
```

The two annotation elements belong to a playlist with annotations. `<PlaylistAnnotationList>` throws without the `AnnotationProvider` of `@waveform-playlist/annotations`; without annotations, leave both out.

An editor with a narrower controls column, a close button on each track, clip headers, fade curves and a playhead with a marker:

```tsx
import {
  ClipInteractionProvider,
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformClipHeaders,
  WaveformFades,
  WaveformSelection,
  WaveformPlayhead,
} from '@waveform-playlist/browser';
import { PlayheadWithMarker } from '@waveform-playlist/ui-components';

<ClipInteractionProvider>
  <WaveformRoot className="my-editor">
    <WaveformTimescale />
    <WaveformLoopRegion />
    <WaveformTrackControls width={160} onRemoveTrack={removeTrack} />
    <WaveformTracks gainScaled>
      <WaveformClipHeaders />
      <WaveformFades />
    </WaveformTracks>
    <WaveformSelection />
    <WaveformPlayhead renderPlayhead={PlayheadWithMarker} />
  </WaveformRoot>
</ClipInteractionProvider>
```

A bare waveform, with no ruler and no controls:

```tsx
<WaveformRoot>
  <WaveformTracks />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
```

What each part does when it is there:

- **`WaveformTimescale`** and **`WaveformLoopRegion`** share a 30 px strip above the tracks. The strip exists when a root has either of them. The loop region draws nothing while looping is off.
- **`WaveformTrackControls`** makes the controls column exist. Without it there is no column. Its `width` (a positive number, 200 by default) is read by the root from the element; with `0`, a negative number or `NaN` no column is drawn and a development warning says so.
- **`WaveformClipHeaders`** adds a header to every clip and to the height of every row. Inside a `ClipInteractionProvider` the header is what a clip is dragged by, and the trim handles come with it.
- **`WaveformPlayhead`** is shown while playing, and at rest when no range is selected.

### MediaElement Player

The same parts, inside `MediaElementWaveformRoot`. This is what `<MediaElementWaveform />` renders:

```tsx
import {
  MediaElementWaveformRoot,
  WaveformTimescale,
  WaveformTracks,
  MediaElementAnnotationBoxes,
  WaveformSelection,
  WaveformPlayhead,
  MediaElementAnnotationList,
} from '@waveform-playlist/browser';

<MediaElementWaveformRoot>
  <WaveformTimescale />
  <WaveformTracks />
  <MediaElementAnnotationBoxes />
  <WaveformSelection />
  <WaveformPlayhead />
</MediaElementWaveformRoot>
<MediaElementAnnotationList />
```

Without annotations, leave the two annotation elements out. A player without a ruler and with fade curves:

```tsx
<MediaElementWaveformRoot>
  <WaveformTracks>
    <WaveformFades />
  </WaveformTracks>
  <WaveformSelection />
  <WaveformPlayhead />
</MediaElementWaveformRoot>
```

There are no track controls, no loop region and no recording for this player.

## Switching a Part On and Off

Render the part or `null`:

```tsx
<WaveformRoot>
  {showRuler ? <WaveformTimescale /> : null}
  <WaveformTrackControls />
  <WaveformTracks>{showFades ? <WaveformFades /> : null}</WaveformTracks>
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
```

Written this way (or as `flag && <Part />`), the parts after it keep their state. A list whose length changes (`parts.filter(Boolean)`) remounts the parts after the one that went, unless they have keys.

## Your Own Elements Among the Parts

A child of a root that is not a part is drawn in the scrolling tracks area, in the order you wrote it among the parts drawn there (the tracks, the annotation boxes, the selection, the playhead). It scrolls with the waveform.

To place something at a time, convert seconds to pixels with the sample rate and the zoom:

```tsx
import { usePlaylistView, usePlaylistZoom } from '@waveform-playlist/browser';

function Marker({ time }: { time: number }) {
  const { sampleRate } = usePlaylistView();
  const { samplesPerPixel } = usePlaylistZoom();
  const left = (time * sampleRate) / samplesPerPixel;
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left,
        width: 1,
        height: '100%',
        background: 'orange',
        pointerEvents: 'none',
      }}
    />
  );
}

<WaveformRoot>
  <WaveformTimescale />
  <WaveformTracks />
  <Marker time={12.5} />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
```

Your own component may wrap anything of its own. It must not wrap a part: see the next section.

## Where a Part Must Be

The root recognises a part by the type of the element, and so does `<WaveformTracks>` for its three children. Therefore:

- A part is a child of its root, or of a fragment in it. A part **wrapped in your own component** is not recognised: a wrapped `<WaveformTimescale>` or `<WaveformTrackControls>` is drawn in the tracks area, a wrapped `<WaveformClipHeaders>` does nothing. Wrap the whole root in your component, not a part.
- `<WaveformClipHeaders>`, `<WaveformFades>` and `<WaveformRecordingPreview>` are children of `<WaveformTracks>` (a fragment is fine) and draw nothing anywhere else. `<WaveformTracks>` renders no other child.
- One `<WaveformTracks>` per root, and it must be the root's own child: the root reads the clip headers from it for the row heights.
- `<WaveformTimescale>`, `<WaveformLoopRegion>`, `<WaveformTrackControls>`, `<WaveformTracks>` and both annotation rows throw outside a root ("The timescale must be rendered inside the waveform root"). `<WaveformSelection>` and `<WaveformPlayhead>` draw wherever they are rendered under a provider; they are positioned for the tracks area.
- Two roots under one provider both draw the playlist, each with its own playhead and selection drag. Automatic scroll follows the root that mounted last.

### Which Provider

- `<WaveformRoot>` needs `WaveformPlaylistProvider`; `<MediaElementWaveformRoot>` needs `MediaElementPlaylistProvider`. Each throws under the other.
- `<WaveformLoopRegion>`, `<WaveformTrackControls>`, `<WaveformRecordingPreview>` and `<WaveformAnnotationBoxes>` need `WaveformPlaylistProvider`. Under `MediaElementPlaylistProvider` the loop region throws ("useLoop needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it") and so do the annotation boxes (the same message for `useAnnotationEditing`); the track controls draw nothing as a child of the root, and throw the same kind of message when wrapped in a component; the recording preview throws once a take runs into the player's track.
- `<MediaElementAnnotationBoxes>` is for `MediaElementPlaylistProvider`. Under `WaveformPlaylistProvider` it draws, but an edge can be dragged past the end of the audio to the end of the drawn timeline: use `<WaveformAnnotationBoxes>` there.
- `<WaveformClipHeaders>` under `MediaElementPlaylistProvider` shows the track's `name` in the header ("Track" without one). Nothing under that provider supports dragging the clip: leave clip interaction off above it.

### Development Warnings

In development a part that is not where it can work says so once in the console, with the prefix `[waveform-playlist]`. It does not throw. The cases:

- `<WaveformTimescale>`, `<WaveformLoopRegion>` or `<WaveformTrackControls>` drawn among the tracks (it was wrapped in another component).
- `<WaveformClipHeaders>`, `<WaveformFades>` or `<WaveformRecordingPreview>` rendered outside `<WaveformTracks>`.
- A child of `<WaveformTracks>` that is not one of those three.
- More than one `<WaveformTracks>` in a root, or a `<WaveformTracks>` that the root cannot see (wrapped in another component) while it holds `<WaveformClipHeaders>` or `<WaveformRecordingPreview>`.
- More than one `<WaveformTrackControls>` in a root (each draws a panel per track in the one column), or one whose `width` is not a positive number (no column is drawn).
- `<WaveformTrackControls>` inside `<MediaElementWaveformRoot>`.

## Recording

`<WaveformRecordingPreview>` draws the take while it is recorded. It only draws: call `useRecordingSession` so that the provider mutes what the armed track already holds and keeps playback running past the end of the audio. See the [Recording guide](/docs/react/guides/recording#keeping-preview-and-clip-in-sync).

## Upgrading

Coming from a version where props on `<Waveform>` and on the provider switched the parts? The [upgrade guide](/docs/react/upgrading#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed) has the replacement for each.

## See Also

- [Components reference](/docs/react/api/components#the-view-roots-parts-and-ready-made-compositions)
- [Custom Drag Setup](/docs/react/guides/custom-drag-setup)
- [Annotations](/docs/react/guides/annotations)
