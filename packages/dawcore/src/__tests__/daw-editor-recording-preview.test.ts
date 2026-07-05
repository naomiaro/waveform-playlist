// Recording live-preview clip chrome on <daw-editor>.
//
// During a take, the preview must render inside the same .clip-container +
// .clip-header markup as finalized clips (when `clip-headers` is set), so the
// take reads as a clip WHILE it's being captured — previously the header only
// appeared after finalization, and the preview waveforms sat clipHeaderHeight
// too high compared to where the finalized clip lands.
//
// The header label comes from RecordingOptions.clipName (also used as the
// finalized clip's name), falling back to "Recording…".
import { describe, it, expect, vi, afterEach } from 'vitest';
import '../index';
import type { DawEditorElement } from '../elements/daw-editor';

function makeMockAdapter() {
  return {
    audioContext: {
      sampleRate: 48000,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    init: vi.fn().mockResolvedValue(undefined),
    setTracks: vi.fn(),
    updateTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    isPlaying: vi.fn().mockReturnValue(false),
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    setLoop: vi.fn(),
    dispose: vi.fn(),
  };
}

/** Narrow view of the editor internals the tests poke at. */
interface EditorInternals {
  _recordingController: { getSession: (trackId: string) => unknown };
}

function fakeSession(trackId: string, overrides: Record<string, unknown> = {}) {
  return {
    trackId,
    totalSamples: 48000, // 1s → 46 px at 1024 spp
    latencySamples: 0,
    startSample: 0,
    channelCount: 1,
    peaks: [new Int16Array(200)],
    bits: 16,
    ...overrides,
  };
}

describe('daw-editor recording live-preview clip chrome', () => {
  let editor: DawEditorElement;
  let trackId: string;

  async function setup(withHeaders: boolean) {
    editor = document.createElement('daw-editor') as DawEditorElement;
    if (withHeaders) editor.setAttribute('clip-headers', '');
    editor.adapter = makeMockAdapter() as never;
    document.body.appendChild(editor);
    await editor.addTrack({ name: 'Take 1' });
    await editor.updateComplete;
    trackId = editor.tracks[0].trackId;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    editor.remove();
  });

  function stubSession(session: unknown) {
    const internals = editor as unknown as EditorInternals;
    internals._recordingController.getSession = (id: string) =>
      id === trackId ? session : undefined;
  }

  it('renders the preview inside a clip container with a header while recording', async () => {
    await setup(true);
    stubSession(fakeSession(trackId));
    editor.requestUpdate();
    await editor.updateComplete;

    const container = editor.shadowRoot!.querySelector('.clip-container.recording-preview');
    expect(container).not.toBeNull();
    const header = container!.querySelector('.clip-header');
    expect(header).not.toBeNull();
    expect(header!.textContent).toContain('Recording…');

    // Waveforms sit below the header — same vertical offset the finalized
    // clip will have (clipHeaderHeight defaults to 20).
    const waveform = container!.querySelector('daw-waveform[data-recording-track]');
    expect(waveform).not.toBeNull();
    expect((waveform as HTMLElement).style.top).toBe('20px');
  });

  it('uses RecordingOptions.clipName as the header label when provided', async () => {
    await setup(true);
    stubSession(fakeSession(trackId, { clipName: 'Take 1' }));
    editor.requestUpdate();
    await editor.updateComplete;

    const header = editor.shadowRoot!.querySelector(
      '.clip-container.recording-preview .clip-header'
    );
    expect(header).not.toBeNull();
    expect(header!.textContent).toContain('Take 1');
  });

  it('renders no header (and no offset) when clip-headers is off', async () => {
    await setup(false);
    stubSession(fakeSession(trackId));
    editor.requestUpdate();
    await editor.updateComplete;

    const container = editor.shadowRoot!.querySelector('.clip-container.recording-preview');
    expect(container).not.toBeNull();
    expect(container!.querySelector('.clip-header')).toBeNull();
    const waveform = container!.querySelector('daw-waveform[data-recording-track]');
    expect((waveform as HTMLElement).style.top).toBe('0px');
  });

  it('stacks multi-channel previews below the header', async () => {
    await setup(true);
    stubSession(
      fakeSession(trackId, {
        channelCount: 2,
        peaks: [new Int16Array(200), new Int16Array(200)],
      })
    );
    editor.requestUpdate();
    await editor.updateComplete;

    const waveforms = editor.shadowRoot!.querySelectorAll(
      '.clip-container.recording-preview daw-waveform[data-recording-track]'
    );
    expect(waveforms).toHaveLength(2);
    // wave-height defaults to 128: ch0 at 20, ch1 at 20 + 128
    expect((waveforms[0] as HTMLElement).style.top).toBe('20px');
    expect((waveforms[1] as HTMLElement).style.top).toBe('148px');
  });
});
