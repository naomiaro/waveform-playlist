import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-editor');
});

/**
 * Branch-matrix tests for `<daw-editor>.togglePauseRecording`. Verifies the
 * three documented branches plus the cycle-isolation fix where
 * `_wasPlayingDuringRecording` must not leak between cycles.
 *
 * Strategy: construct a real editor, replace the recording controller's
 * methods + state with spies/getters, and stub editor.play/pause. We don't
 * need a real adapter or worklet — togglePauseRecording only touches the
 * controller and play/pause.
 */
function setupEditor(
  opts: { isRecording?: boolean; isPaused?: boolean; isPlaying?: boolean } = {}
) {
  const editor = document.createElement('daw-editor') as unknown as {
    _recordingController: {
      pauseRecording: ReturnType<typeof vi.fn>;
      resumeRecording: ReturnType<typeof vi.fn>;
      readonly isRecording: boolean;
      readonly isPaused: boolean;
    };
    _isPlaying: boolean;
    _wasPlayingDuringRecording: boolean;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    currentTime: number;
    togglePauseRecording: () => void;
    resumeRecording: () => void;
  };

  const controller = editor._recordingController;
  controller.pauseRecording = vi.fn();
  controller.resumeRecording = vi.fn();
  Object.defineProperty(controller, 'isRecording', { get: () => opts.isRecording ?? false });
  Object.defineProperty(controller, 'isPaused', { get: () => opts.isPaused ?? false });

  editor._isPlaying = opts.isPlaying ?? false;
  editor._wasPlayingDuringRecording = false;
  editor.play = vi.fn(() => Promise.resolve());
  editor.pause = vi.fn();
  Object.defineProperty(editor, 'currentTime', { get: () => 5, configurable: true });

  return editor;
}

describe('togglePauseRecording branch matrix', () => {
  it('does nothing when not recording', () => {
    const editor = setupEditor({ isRecording: false });
    editor.togglePauseRecording();
    expect(editor._recordingController.pauseRecording).not.toHaveBeenCalled();
    expect(editor._recordingController.resumeRecording).not.toHaveBeenCalled();
    expect(editor.pause).not.toHaveBeenCalled();
    expect(editor.play).not.toHaveBeenCalled();
  });

  it('pauses worklet only when recording without active Transport', () => {
    const editor = setupEditor({ isRecording: true, isPaused: false, isPlaying: false });
    editor.togglePauseRecording();
    expect(editor._recordingController.pauseRecording).toHaveBeenCalled();
    expect(editor.pause).not.toHaveBeenCalled();
    expect(editor._wasPlayingDuringRecording).toBe(false);
  });

  it('pauses worklet AND Transport during overdub', () => {
    const editor = setupEditor({ isRecording: true, isPaused: false, isPlaying: true });
    editor.togglePauseRecording();
    expect(editor._recordingController.pauseRecording).toHaveBeenCalled();
    expect(editor.pause).toHaveBeenCalled();
    expect(editor._wasPlayingDuringRecording).toBe(true);
  });

  it('resumes worklet only when no Transport was running before pause', () => {
    const editor = setupEditor({ isRecording: true, isPaused: true });
    editor._wasPlayingDuringRecording = false;
    editor.togglePauseRecording();
    expect(editor._recordingController.resumeRecording).toHaveBeenCalled();
    expect(editor.play).not.toHaveBeenCalled();
  });

  it('resumes both worklet AND Transport during overdub', () => {
    const editor = setupEditor({ isRecording: true, isPaused: true });
    editor._wasPlayingDuringRecording = true;
    editor.togglePauseRecording();
    expect(editor._recordingController.resumeRecording).toHaveBeenCalled();
    expect(editor.play).toHaveBeenCalled();
    // Ref cleared so next pause cycle starts fresh
    expect(editor._wasPlayingDuringRecording).toBe(false);
  });

  it('cycle isolation: programmatic resumeRecording clears the wasPlaying ref', () => {
    // Setup: simulate a paused-during-overdub state
    const editor = setupEditor({ isRecording: true, isPaused: true });
    editor._wasPlayingDuringRecording = true;

    // External code calls editor.resumeRecording() directly (bypassing toggle)
    editor.resumeRecording();

    // The ref must be cleared so the next pause cycle (with Transport
    // stopped) doesn't auto-restart Transport on resume.
    expect(editor._wasPlayingDuringRecording).toBe(false);
  });
});
