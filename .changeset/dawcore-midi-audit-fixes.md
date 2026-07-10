---
'@dawcore/midi': patch
---

Correctness audit fixes: `getTrackDuration` no longer crashes with a RangeError on very dense MIDI files (~130k+ notes — the `Math.max(...spread)` argument-stack limit); `parseMidiFile` wraps invalid-input errors with byte-count context instead of leaking raw `@tonejs/midi` internals; `parseMidiUrl` includes the HTTP status code in fetch errors (statusText is often empty on HTTP/2); the `flatten` option's edge cases (zero note-bearing tracks → zero result tracks; merged track-level metadata comes from the first track) are now documented.
