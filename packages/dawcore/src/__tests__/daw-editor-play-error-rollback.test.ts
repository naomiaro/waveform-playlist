import { describe, it, expect, vi, afterEach } from 'vitest';
import '../elements/daw-editor';
import type { DawEditorElement } from '../elements/daw-editor';
import type { DawErrorDetail } from '../events';

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
  };
}

describe('editor.play error-path rollback', () => {
  let editor: DawEditorElement;

  afterEach(() => {
    editor?.remove();
  });

  it('stops the playhead loop and clears the endTime watermark when engine.play throws', async () => {
    editor = document.createElement('daw-editor') as DawEditorElement;
    document.body.appendChild(editor);
    const adapter = makeMockAdapter();
    adapter.play.mockImplementation(() => {
      throw new Error('boom');
    });
    editor.adapter = adapter as never;
    editor.addTrack({ name: 'T', midi: { notes: [] } });
    await editor.ready();

    let errorDetail: DawErrorDetail | undefined;
    const stopSpy = vi.fn();
    editor.addEventListener('daw-error', (e) => {
      errorDetail = (e as CustomEvent<DawErrorDetail>).detail;
    });
    editor.addEventListener('daw-stop', stopSpy);

    await expect(editor.play(1, 2)).resolves.toBeUndefined();

    expect(errorDetail).toBeDefined();
    expect(errorDetail?.operation).toBe('play');

    // The playhead rAF loop must be rolled back — _playbackAnimation's
    // internal `_running` flag mirrors what stop() would have reset.
    expect(
      (editor as unknown as { _playbackAnimation: { _running: boolean } })._playbackAnimation
        ._running
    ).toBe(false);
    expect(
      (editor as unknown as { _activePlayEndTime: number | null })._activePlayEndTime
    ).toBeNull();

    // No spurious daw-stop should fire during a short flush window.
    await new Promise((r) => setTimeout(r, 50));
    expect(stopSpy).not.toHaveBeenCalled();
  });
});
