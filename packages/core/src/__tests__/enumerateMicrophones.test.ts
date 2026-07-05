import { describe, it, expect, vi } from 'vitest';
import { enumerateMicrophones, watchMicrophoneDevices } from '../enumerateMicrophones';

function makeMediaDevices(devices: Partial<MediaDeviceInfo>[]) {
  const listeners = new Set<() => void>();
  return {
    mediaDevices: {
      enumerateDevices: vi.fn(async () => devices as MediaDeviceInfo[]),
      addEventListener: vi.fn((type: string, cb: () => void) => {
        if (type === 'devicechange') listeners.add(cb);
      }),
      removeEventListener: vi.fn((type: string, cb: () => void) => {
        if (type === 'devicechange') listeners.delete(cb);
      }),
    } as unknown as MediaDevices,
    fireDeviceChange: () => listeners.forEach((cb) => cb()),
    listenerCount: () => listeners.size,
  };
}

describe('enumerateMicrophones', () => {
  it('reports unsupported when mediaDevices is unavailable', async () => {
    const result = await enumerateMicrophones(undefined);
    expect(result.supported).toBe(false);
    expect(result.hasLabels).toBe(false);
    expect(result.devices).toEqual([]);
  });

  it('filters to audio inputs and maps fields (labels present)', async () => {
    const { mediaDevices } = makeMediaDevices([
      { kind: 'audioinput', deviceId: 'mic-1', label: 'Built-in Mic', groupId: 'g1' },
      { kind: 'videoinput', deviceId: 'cam-1', label: 'Webcam', groupId: 'g2' },
      { kind: 'audiooutput', deviceId: 'spk-1', label: 'Speakers', groupId: 'g1' },
      { kind: 'audioinput', deviceId: 'mic-2', label: 'USB Mic', groupId: 'g3' },
    ]);

    const result = await enumerateMicrophones(mediaDevices);

    expect(result.supported).toBe(true);
    expect(result.hasLabels).toBe(true);
    expect(result.devices).toEqual([
      { deviceId: 'mic-1', label: 'Built-in Mic', groupId: 'g1' },
      { deviceId: 'mic-2', label: 'USB Mic', groupId: 'g3' },
    ]);
  });

  it('reports hasLabels=false and generates fallback labels pre-permission', async () => {
    // Chrome pre-permission: single placeholder entry with empty label AND
    // empty deviceId; Firefox: real entries with empty labels.
    const { mediaDevices } = makeMediaDevices([
      { kind: 'audioinput', deviceId: '', label: '', groupId: '' },
      { kind: 'audioinput', deviceId: 'abcdef1234567890', label: '', groupId: 'g2' },
    ]);

    const result = await enumerateMicrophones(mediaDevices);

    expect(result.supported).toBe(true);
    expect(result.hasLabels).toBe(false);
    // Empty deviceId → positional name; present deviceId → id-derived name
    expect(result.devices[0].label).toBe('Microphone 1');
    expect(result.devices[1].label).toBe('Microphone abcdef12');
  });
});

describe('watchMicrophoneDevices', () => {
  it('fires immediately and again on devicechange; unsubscribe detaches', async () => {
    const { mediaDevices, fireDeviceChange, listenerCount } = makeMediaDevices([
      { kind: 'audioinput', deviceId: 'mic-1', label: 'Mic', groupId: 'g1' },
    ]);

    const seen: number[] = [];
    const unsubscribe = watchMicrophoneDevices((result) => {
      seen.push(result.devices.length);
    }, mediaDevices);

    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(listenerCount()).toBe(1);

    fireDeviceChange();
    await vi.waitFor(() => expect(seen).toHaveLength(2));

    unsubscribe();
    expect(listenerCount()).toBe(0);
    fireDeviceChange();
    // No further deliveries after unsubscribe
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toHaveLength(2);
  });

  it('delivers a single unsupported result when mediaDevices is unavailable', async () => {
    const seen: Array<{ supported: boolean }> = [];
    const unsubscribe = watchMicrophoneDevices((result) => {
      seen.push(result);
    }, undefined);

    await vi.waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0].supported).toBe(false);
    expect(() => unsubscribe()).not.toThrow();
  });
});
