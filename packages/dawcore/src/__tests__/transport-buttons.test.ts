import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-transport');
  await import('../elements/daw-play-button');
  await import('../elements/daw-pause-button');
  await import('../elements/daw-stop-button');
  await import('../elements/daw-record-button');
});

/**
 * Helper: create a mock editor target with transport wired up.
 * Returns the editor, transport, and all button elements.
 */
function createTransport() {
  const editor = document.createElement('div') as any;
  editor.id = 'test-editor';
  editor.play = vi.fn();
  editor.pause = vi.fn();
  editor.stop = vi.fn();
  editor.startRecording = vi.fn();
  editor.stopRecording = vi.fn();
  editor.pauseRecording = vi.fn();
  editor.resumeRecording = vi.fn();
  editor.isRecording = false;
  editor.recordingStream = {};
  document.body.appendChild(editor);

  const transport = document.createElement('daw-transport') as any;
  transport.setAttribute('for', 'test-editor');
  document.body.appendChild(transport);

  const playBtn = document.createElement('daw-play-button') as any;
  const pauseBtn = document.createElement('daw-pause-button') as any;
  const stopBtn = document.createElement('daw-stop-button') as any;
  const recordBtn = document.createElement('daw-record-button') as any;
  transport.appendChild(playBtn);
  transport.appendChild(pauseBtn);
  transport.appendChild(stopBtn);
  transport.appendChild(recordBtn);

  return { editor, transport, playBtn, pauseBtn, stopBtn, recordBtn };
}

function cleanup(...els: HTMLElement[]) {
  els.forEach((el) => el.remove());
}

/** Simulate recording start/complete/error events on the editor */
function fireRecordingStart(editor: HTMLElement) {
  editor.dispatchEvent(new CustomEvent('daw-recording-start', { bubbles: true }));
}
function fireRecordingComplete(editor: HTMLElement) {
  editor.dispatchEvent(new CustomEvent('daw-recording-complete', { bubbles: true }));
}
function fireRecordingError(editor: HTMLElement) {
  editor.dispatchEvent(new CustomEvent('daw-recording-error', { bubbles: true }));
}

describe('Record button', () => {
  it('calls startRecording on click', async () => {
    const { editor, transport, recordBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    recordBtn.shadowRoot?.querySelector('button')?.click();
    expect(editor.startRecording).toHaveBeenCalled();

    cleanup(editor, transport);
  });

  it('shows data-recording attribute when recording starts', async () => {
    const { editor, transport, recordBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    fireRecordingStart(editor);
    await new Promise((r) => setTimeout(r, 20));

    const button = recordBtn.shadowRoot?.querySelector('button');
    expect(button?.hasAttribute('data-recording')).toBe(true);

    cleanup(editor, transport);
  });

  it('ignores click while recording (start-only)', async () => {
    const { editor, transport, recordBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    fireRecordingStart(editor);
    await new Promise((r) => setTimeout(r, 20));
    editor.startRecording.mockClear();

    recordBtn.shadowRoot?.querySelector('button')?.click();
    expect(editor.startRecording).not.toHaveBeenCalled();

    cleanup(editor, transport);
  });

  it('resets data-recording on recording complete', async () => {
    const { editor, transport, recordBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    fireRecordingStart(editor);
    await new Promise((r) => setTimeout(r, 20));
    fireRecordingComplete(editor);
    await new Promise((r) => setTimeout(r, 20));

    const button = recordBtn.shadowRoot?.querySelector('button');
    expect(button?.hasAttribute('data-recording')).toBe(false);

    cleanup(editor, transport);
  });

  it('resets data-recording on recording error', async () => {
    const { editor, transport, recordBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    fireRecordingStart(editor);
    await new Promise((r) => setTimeout(r, 20));
    fireRecordingError(editor);
    await new Promise((r) => setTimeout(r, 20));

    const button = recordBtn.shadowRoot?.querySelector('button');
    expect(button?.hasAttribute('data-recording')).toBe(false);

    cleanup(editor, transport);
  });
});

describe('Play button', () => {
  it('calls play on click', async () => {
    const { editor, transport, playBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    playBtn.shadowRoot?.querySelector('button')?.click();
    expect(editor.play).toHaveBeenCalled();

    cleanup(editor, transport);
  });

  it('is disabled while recording', async () => {
    const { editor, transport, playBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    fireRecordingStart(editor);
    await new Promise((r) => setTimeout(r, 20));

    const button = playBtn.shadowRoot?.querySelector('button');
    expect(button?.disabled).toBe(true);

    cleanup(editor, transport);
  });

  it('re-enables after recording completes', async () => {
    const { editor, transport, playBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    fireRecordingStart(editor);
    await new Promise((r) => setTimeout(r, 20));
    fireRecordingComplete(editor);
    await new Promise((r) => setTimeout(r, 20));

    const button = playBtn.shadowRoot?.querySelector('button');
    expect(button?.disabled).toBe(false);

    cleanup(editor, transport);
  });
});

describe('Pause button', () => {
  it('calls pause on click when not recording', async () => {
    const { editor, transport, pauseBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    pauseBtn.shadowRoot?.querySelector('button')?.click();
    expect(editor.pause).toHaveBeenCalled();

    cleanup(editor, transport);
  });

  it('calls pauseRecording + pause on first click during recording', async () => {
    const { editor, transport, pauseBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    fireRecordingStart(editor);
    await new Promise((r) => setTimeout(r, 20));

    pauseBtn.shadowRoot?.querySelector('button')?.click();
    expect(editor.pauseRecording).toHaveBeenCalled();
    expect(editor.pause).toHaveBeenCalled();

    cleanup(editor, transport);
  });

  it('shows data-paused attribute when paused during recording', async () => {
    const { editor, transport, pauseBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    fireRecordingStart(editor);
    await new Promise((r) => setTimeout(r, 20));
    pauseBtn.shadowRoot?.querySelector('button')?.click();
    await new Promise((r) => setTimeout(r, 20));

    const button = pauseBtn.shadowRoot?.querySelector('button');
    expect(button?.hasAttribute('data-paused')).toBe(true);

    cleanup(editor, transport);
  });

  it('calls resumeRecording + play on second click during recording', async () => {
    const { editor, transport, pauseBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    fireRecordingStart(editor);
    await new Promise((r) => setTimeout(r, 20));

    // First click: pause
    pauseBtn.shadowRoot?.querySelector('button')?.click();
    editor.resumeRecording.mockClear();
    editor.play.mockClear();

    // Second click: resume
    pauseBtn.shadowRoot?.querySelector('button')?.click();
    expect(editor.resumeRecording).toHaveBeenCalled();
    expect(editor.play).toHaveBeenCalled();

    cleanup(editor, transport);
  });

  it('resets paused state when recording completes', async () => {
    const { editor, transport, pauseBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    fireRecordingStart(editor);
    await new Promise((r) => setTimeout(r, 20));
    pauseBtn.shadowRoot?.querySelector('button')?.click();
    await new Promise((r) => setTimeout(r, 20));

    fireRecordingComplete(editor);
    await new Promise((r) => setTimeout(r, 20));

    const button = pauseBtn.shadowRoot?.querySelector('button');
    expect(button?.hasAttribute('data-paused')).toBe(false);

    cleanup(editor, transport);
  });
});

describe('Stop button', () => {
  it('calls stop on click', async () => {
    const { editor, transport, stopBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    stopBtn.shadowRoot?.querySelector('button')?.click();
    expect(editor.stop).toHaveBeenCalled();

    cleanup(editor, transport);
  });

  it('calls stopRecording + stop when recording is active', async () => {
    const { editor, transport, stopBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    editor.isRecording = true;
    stopBtn.shadowRoot?.querySelector('button')?.click();
    expect(editor.stopRecording).toHaveBeenCalled();
    expect(editor.stop).toHaveBeenCalled();

    cleanup(editor, transport);
  });

  it('does not call stopRecording when not recording', async () => {
    const { editor, transport, stopBtn } = createTransport();
    await new Promise((r) => setTimeout(r, 20));

    stopBtn.shadowRoot?.querySelector('button')?.click();
    expect(editor.stopRecording).not.toHaveBeenCalled();
    expect(editor.stop).toHaveBeenCalled();

    cleanup(editor, transport);
  });
});
