import { describe, it, expect, vi, afterEach } from 'vitest';
import '../elements/daw-editor';
import type { DawEditorElement } from '../elements/daw-editor';

function makeMockAdapter() {
  // Minimal PlayoutAdapter stub — engine accepts but doesn't actually play.
  const ctx = {
    sampleRate: 48000,
    state: 'suspended' as AudioContextState,
    destination: {} as AudioDestinationNode,
    resume: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    audioContext: ctx as unknown as AudioContext,
    ppqn: 960,
    setTracks: vi.fn(),
    updateTrack: vi.fn(),
    setTempo: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setLoop: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false),
    onPlaybackEnded: vi.fn(),
    getCurrentTime: vi.fn().mockReturnValue(0),
  };
}

/** Flush both the microtask queue (engine's queueMicrotask for #608 bounded
 * completion) and a macrotask tick, so any resulting synchronous engine
 * 'stop' emission and its listeners have fully settled. */
async function flushAsync() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('editor.play endTime forwarding', () => {
  let editor: DawEditorElement;

  afterEach(() => {
    editor?.remove();
  });

  it('forwards endTime to the adapter play call', async () => {
    editor = document.createElement('daw-editor') as DawEditorElement;
    document.body.appendChild(editor);
    const adapter = makeMockAdapter();
    editor.adapter = adapter as never;
    editor.addTrack({ name: 'T', midi: { notes: [] } });
    await editor.ready();
    await editor.play(1, 2);
    expect(adapter.play).toHaveBeenCalledWith(1, 2);
  });

  it('dispatches daw-stop exactly once on an engine-initiated bounded-playback stop (#608)', async () => {
    editor = document.createElement('daw-editor') as DawEditorElement;
    document.body.appendChild(editor);
    const adapter = makeMockAdapter();
    editor.adapter = adapter as never;
    editor.addTrack({ name: 'T', midi: { notes: [] } });
    await editor.ready();

    // The engine subscribes once, in its constructor — capture the callback
    // it registered on the adapter's onPlaybackEnded hook.
    expect(adapter.onPlaybackEnded).toHaveBeenCalledTimes(1);
    const onPlaybackEnded = adapter.onPlaybackEnded.mock.calls[0][0] as () => void;

    await editor.play(1, 2);

    const dawStopEvents: Event[] = [];
    editor.addEventListener('daw-stop', (e) => dawStopEvents.push(e));

    // Simulate the Tone adapter reporting bounded-playback completion.
    onPlaybackEnded();
    await flushAsync();

    expect(dawStopEvents).toHaveLength(1);
    expect(editor.isPlaying).toBe(false);
    expect((editor as unknown as { _activePlayEndTime: number | null })._activePlayEndTime).toBe(
      null
    );
  });

  it('dispatches daw-stop exactly once on a consumer-initiated stop()', async () => {
    editor = document.createElement('daw-editor') as DawEditorElement;
    document.body.appendChild(editor);
    const adapter = makeMockAdapter();
    editor.adapter = adapter as never;
    editor.addTrack({ name: 'T', midi: { notes: [] } });
    await editor.ready();
    await editor.play(1, 2);

    const dawStopEvents: Event[] = [];
    editor.addEventListener('daw-stop', (e) => dawStopEvents.push(e));

    editor.stop();
    await flushAsync();

    expect(dawStopEvents).toHaveLength(1);
    expect(editor.isPlaying).toBe(false);
  });
});
