// #945: the microphone the picker names is the one that is open, read from
// the stream, and `hasLabels` says whether the device list can be offered
// before any microphone is open.
import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createArrangement } from '@waveform-playlist/engine';
import type { ArrangementTrack } from '@waveform-playlist/core';
import { env, resetRecordingEnv } from './helpers/recordingEnv';

vi.mock(
  '@waveform-playlist/playout',
  async () => (await import('./helpers/recordingEnv')).playoutModule
);
vi.mock(
  '@waveform-playlist/worklets',
  async () => (await import('./helpers/recordingEnv')).workletsModule
);
vi.mock('@waveform-playlist/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/core')>();
  return { ...actual, ...(await import('./helpers/recordingEnv')).coreOverrides };
});

const { useIntegratedRecording } = await import('../hooks/useIntegratedRecording');
const { useMicrophoneAccess } = await import('../hooks/useMicrophoneAccess');

const arrangement = () =>
  createArrangement({
    tracks: [{ id: 't', name: 't', kind: 'audio', clips: [] } as unknown as ArrangementTrack],
  });

interface ListedDevice {
  deviceId: string;
  label: string;
}

/** What `enumerateDevices()` answers from now on. */
function listDevices(devices: ListedDevice[]): void {
  const mediaDevices = navigator.mediaDevices as unknown as {
    enumerateDevices: ReturnType<typeof vi.fn>;
  };
  mediaDevices.enumerateDevices.mockImplementation(async () =>
    devices.map((d) => ({ kind: 'audioinput', groupId: 'g', ...d }))
  );
}

// Before a grant, Firefox and WebKit list one entry with no id and no label
// (measured on #945; Chromium does the same without a remembered permission).
const REDACTED: ListedDevice[] = [{ deviceId: '', label: '' }];
const LISTED: ListedDevice[] = [
  { deviceId: 'dev-a', label: 'Mic A' },
  { deviceId: 'dev-b', label: 'Mic B' },
];

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  resetRecordingEnv();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('useIntegratedRecording: selectedDevice is the open microphone', () => {
  it('names the default device when it is not the first of the list', async () => {
    listDevices(LISTED);
    env.defaultDeviceId = 'dev-b';
    const { result } = renderHook(() => useIntegratedRecording(arrangement(), 't'));

    await act(async () => {
      await result.current.requestMicAccess();
    });

    // The stream is dev-b's; the first of the list is dev-a.
    expect(result.current.selectedDevice).toBe('dev-b');
  });

  it("names Chromium's default entry when the default device is open", async () => {
    // Chromium lists a "default" entry, and the stream opened without an id
    // reports that id (measured on #945).
    listDevices([{ deviceId: 'default', label: 'Default - Mic A' }, ...LISTED]);
    env.defaultDeviceId = 'default';
    const { result } = renderHook(() => useIntegratedRecording(arrangement(), 't'));

    await act(async () => {
      await result.current.requestMicAccess();
    });

    expect(result.current.selectedDevice).toBe('default');
  });

  it('names nothing while no microphone is open, also with a full list', async () => {
    listDevices(LISTED);
    const { result } = renderHook(() => useIntegratedRecording(arrangement(), 't'));
    await act(settle);

    expect(result.current.devices.map((d) => d.deviceId)).toEqual(['dev-a', 'dev-b']);
    expect(result.current.selectedDevice).toBeNull();
    expect(env.getUserMedia).not.toHaveBeenCalled();
  });

  it('names nothing when the stream has no device id to report', async () => {
    listDevices(LISTED);
    env.defaultDeviceId = '';
    const { result } = renderHook(() => useIntegratedRecording(arrangement(), 't'));

    await act(async () => {
      await result.current.requestMicAccess();
    });

    expect(result.current.stream).not.toBeNull();
    expect(result.current.selectedDevice).toBeNull();
  });
});

describe('hasLabels: the list can be offered before a microphone is open', () => {
  it('is false for the redacted list a browser gives before a grant, and true after it', async () => {
    listDevices(REDACTED);
    const { result } = renderHook(() => useIntegratedRecording(arrangement(), 't'));
    await act(settle);
    expect(result.current.hasLabels).toBe(false);

    listDevices(LISTED);
    await act(async () => {
      await result.current.requestMicAccess();
    });

    expect(result.current.hasLabels).toBe(true);
  });

  it('is true before any stream when the browser already holds the permission, and changeDevice opens only the one chosen', async () => {
    listDevices(LISTED);
    const { result } = renderHook(() => useIntegratedRecording(arrangement(), 't'));
    await act(settle);
    expect(result.current.hasLabels).toBe(true);
    expect(result.current.stream).toBeNull();

    await act(async () => {
      await result.current.changeDevice('dev-b');
    });

    expect(env.getUserMedia).toHaveBeenCalledTimes(1);
    expect(env.getUserMedia.mock.lastCall![0].audio.deviceId).toEqual({ exact: 'dev-b' });
    expect(result.current.selectedDevice).toBe('dev-b');
  });

  it('keeps its value when an enumeration fails', async () => {
    listDevices(LISTED);
    const { result } = renderHook(() => useMicrophoneAccess());
    await act(settle);
    expect(result.current.hasLabels).toBe(true);

    (
      navigator.mediaDevices as unknown as { enumerateDevices: ReturnType<typeof vi.fn> }
    ).enumerateDevices.mockRejectedValueOnce(new Error('NotAllowedError'));
    await act(async () => {
      await result.current.requestAccess();
    });

    expect(result.current.error?.message).toBe('NotAllowedError');
    expect(result.current.hasLabels).toBe(true);
  });
});
