---
'@dawcore/components': patch
---

dawcore: `<daw-editor>` loads through its arrangement (#848).

- The editor owns an arrangement (`createArrangement()` from `@waveform-playlist/engine`) from the moment it is created, and builds its engine on it as soon as it is connected with an `editor.adapter`. `@waveform-playlist/engine` is imported normally (it was loaded with a dynamic import on the first track load).
- A `<daw-track>` enters the arrangement as soon as there is an engine, at its place in the DOM, before its audio has loaded: each audio `<daw-clip>` becomes a loading clip, and the arrangement fetches and decodes it. A `<daw-track>` inserted between two others later lands at its DOM position.
- Loading no longer clears the undo history. The `<daw-track>` elements of the page that enter while the history is empty are not undo steps, so Undo right after load removes nothing; a track added later, by the page or by `editor.addTrack()`, is one undo step. A control moved while a track loads is an undo step like any other.
- A track whose audio failed stays in the editor, like a broken `<img>`: `daw-clip-error` and `daw-track-error` fire, the clip is drawn failed (`--daw-clip-failed-color`), and `editor.retryTrack(trackId)` loads it again (`daw-track-ready` follows). A clip still loading is drawn dimmed where its length is known (`--daw-placeholder-clip-opacity`), with its `.dat` peaks when `peaks-src` gives them.
- `editor.tracks` lists the tracks in the arrangement's order (was: the order they registered in), then those waiting for an adapter; a track an Undo took out is not listed until a Redo brings it back.
- `daw-clip-ready` fires for every clip whose audio has loaded (it fired for an appended clip only). `editor.duration` counts a loading clip whose length is known.
- A clip whose `duration` runs past the end of its audio is cut to the end, with a console warning (it was drawn and played to the declared length, silent past the audio), as in the React editor.
- Tracks added before `editor.adapter` is set wait for it, with one console warning, instead of failing.
- A file drop (`loadFiles`) adds a track with no `<daw-track>` element: its clip's source is the `File`. A file that cannot be loaded is removed with no undo step.

Upgrading:

- `editor.addTrack(config)` resolves with the track id (a string) once the track has entered the editor, not with the `<daw-track>` element once its audio has loaded, and it no longer rejects when the audio fails. Find: `(await editor.addTrack(…)).trackId`. Replace with: `await editor.addTrack(…)`; follow loading with `daw-track-ready` / `daw-track-error` for that id.
- A track whose audio failed is no longer left out: remove it with `editor.removeTrack(trackId)` on `daw-track-error` if the app does not want it shown.
- A dropped file has no `<daw-track>` element: read dropped tracks from `editor.tracks` (or the ids `loadFiles()` resolves with), not from the editor's children.
- After `<daw-editor>` is removed from the document, `editor.adapter` is `null` (the engine disposed it): set a fresh adapter when the editor is inserted again. Its tracks, their mix and the undo history are kept.
