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
  };
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
});
