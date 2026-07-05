/**
 * Framework-agnostic microphone enumeration.
 *
 * Works without requesting a stream, but browsers redact device information
 * until microphone permission is granted: labels are empty everywhere, and
 * Chrome/Safari typically also redact deviceIds (often exposing a single
 * placeholder entry). The `hasLabels` flag tells consumers whether the list
 * is a usable picker or just a "microphones exist" signal — re-enumerate
 * after a successful getUserMedia to get the real list.
 *
 * Follows the probeRangeSupport pattern: the browser API is injectable for
 * tests and non-browser environments degrade gracefully.
 */

export interface MicrophoneDeviceInfo {
  deviceId: string;
  /** Real device label, or a generated fallback name when redacted. */
  label: string;
  groupId: string;
}

export interface MicrophoneEnumeration {
  /** False when enumeration is unavailable — SSR/Node, insecure context
   * (mediaDevices requires HTTPS or localhost), or a very old browser. */
  supported: boolean;
  /** True when the browser exposed real device labels. False before
   * microphone permission is granted (labels — and often deviceIds — are
   * redacted); the `devices` labels are then generated fallbacks. */
  hasLabels: boolean;
  devices: MicrophoneDeviceInfo[];
}

const UNSUPPORTED: MicrophoneEnumeration = Object.freeze({
  supported: false,
  hasLabels: false,
  devices: [],
});

function resolveMediaDevices(mediaDevices?: MediaDevices): MediaDevices | undefined {
  if (mediaDevices) return mediaDevices;
  return typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
}

/**
 * List audio input devices without requesting a stream.
 *
 * @param mediaDevices - Injectable for tests; defaults to `navigator.mediaDevices`.
 */
export async function enumerateMicrophones(
  mediaDevices?: MediaDevices
): Promise<MicrophoneEnumeration> {
  const md = resolveMediaDevices(mediaDevices);
  if (!md || typeof md.enumerateDevices !== 'function') {
    return UNSUPPORTED;
  }

  const all = await md.enumerateDevices();
  const inputs = all.filter((device) => device.kind === 'audioinput');
  const hasLabels = inputs.some((device) => device.label.length > 0);

  return {
    supported: true,
    hasLabels,
    devices: inputs.map((device, index) => ({
      deviceId: device.deviceId,
      label:
        device.label ||
        // Pre-permission fallbacks: Chrome redacts deviceId to '' as well,
        // so fall through to a positional name when there's nothing to slice.
        (device.deviceId ? `Microphone ${device.deviceId.slice(0, 8)}` : `Microphone ${index + 1}`),
      groupId: device.groupId,
    })),
  };
}

/**
 * Subscribe to the microphone device list: the listener fires once with the
 * initial enumeration and again on every `devicechange` (hot-plug, permission
 * grant in some browsers). Returns an unsubscribe function.
 *
 * Enumeration failures are logged and skipped — the subscription survives a
 * transient failure and delivers the next successful enumeration.
 *
 * @param mediaDevices - Injectable for tests; defaults to `navigator.mediaDevices`.
 */
export function watchMicrophoneDevices(
  listener: (enumeration: MicrophoneEnumeration) => void,
  mediaDevices?: MediaDevices
): () => void {
  const md = resolveMediaDevices(mediaDevices);
  if (!md || typeof md.enumerateDevices !== 'function') {
    // Deliver asynchronously so subscribe-then-unsubscribe never re-enters
    // the caller synchronously.
    queueMicrotask(() => listener(UNSUPPORTED));
    return () => {};
  }

  let active = true;

  const deliver = () => {
    enumerateMicrophones(md)
      .then((result) => {
        if (active) listener(result);
      })
      .catch((err) => {
        console.warn('[waveform-playlist] Microphone enumeration failed:', String(err));
      });
  };

  md.addEventListener('devicechange', deliver);
  deliver();

  return () => {
    active = false;
    md.removeEventListener('devicechange', deliver);
  };
}
