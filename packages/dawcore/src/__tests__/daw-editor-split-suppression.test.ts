import { describe, it, expect, vi, beforeAll } from 'vitest';

// Capture the host object the editor hands to the split handler so the
// editor-owned stop/play closures can be exercised in isolation.
vi.mock('../interactions/split-handler', () => ({
  splitAtPlayhead: vi.fn(() => true),
}));

import { splitAtPlayhead } from '../interactions/split-handler';

beforeAll(async () => {
  await import('../elements/daw-editor');
});

function setupEditor(): any {
  const editor = document.createElement('daw-editor') as any;
  editor.adapter = { audioContext: { state: 'running', sampleRate: 48000 } };
  document.body.appendChild(editor);
  editor._engine = {
    stop: vi.fn(),
    play: vi.fn(),
    seek: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getState: vi.fn(() => ({ tracks: [] })),
    on: vi.fn(),
    dispose: vi.fn(),
  };
  return editor;
}

describe('splitAtPlayhead stop closure', () => {
  it('suppresses the transient stop settle via _inSeekTransition (seek-while-playing invariant)', () => {
    const editor = setupEditor();
    editor.splitAtPlayhead();
    const host = vi.mocked(splitAtPlayhead).mock.calls[0][0] as any;

    const flagDuringStopPlayhead: boolean[] = [];
    editor._stopPlayhead = vi.fn(() => {
      flagDuringStopPlayhead.push(editor._inSeekTransition);
    });

    host.stop();

    // Without the flag, engine.stop()'s rewind-to-play-start settle leaks a
    // backward-jumping daw-timeupdate (e.g. 30→0→30 on every split during
    // playback) — the same suppression seekTo and the pointer seek use.
    expect(flagDuringStopPlayhead).toEqual([true]);
    expect(editor._inSeekTransition).toBe(false); // restored afterwards
    expect(editor._engine.stop).toHaveBeenCalled();
    editor.remove();
  });
});
