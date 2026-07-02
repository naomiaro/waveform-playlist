/**
 * Hand-rolled variant of Tone.Offline() that can render on a NATIVE
 * OfflineAudioContext when the app runs in native-context mode — required to
 * host WAM worklets in the offline graph (WAM nodes subclass the native
 * AudioWorkletNode; Tone.Offline hardcodes a standardized-audio-context
 * offline context). In standardized mode the construction is identical to
 * Tone.Offline's, so non-WAM exports behave exactly as before. Unlike
 * upstream, the previous global context is restored in a finally block, so a
 * failed graph build can't leave the offline context installed as the app's
 * global context.
 */
import { getContext, setContext, OfflineContext } from 'tone';
import { isNativeGlobalContext } from '@waveform-playlist/playout';

/** Builds the offline graph. Runs while `context` is the global Tone context. */
export type OfflineBuildCallback = (context: OfflineContext) => Promise<void> | void;

// Concurrent renders would interleave the getContext/setContext swaps below —
// the second caller would capture the first's offline context as "previous"
// and restore a spent OfflineAudioContext as the app's global context.
// Serialize every render through a module-level queue.
let renderQueue: Promise<unknown> = Promise.resolve();

export async function renderToneOffline(
  build: OfflineBuildCallback,
  duration: number,
  channels: number,
  sampleRate: number
): Promise<AudioBuffer> {
  const run = renderQueue.then(() =>
    renderToneOfflineSerial(build, duration, channels, sampleRate)
  );
  renderQueue = run.catch(() => undefined);
  return run;
}

async function renderToneOfflineSerial(
  build: OfflineBuildCallback,
  duration: number,
  channels: number,
  sampleRate: number
): Promise<AudioBuffer> {
  const offlineContext = isNativeGlobalContext()
    ? new OfflineContext(
        new OfflineAudioContext({
          numberOfChannels: channels,
          length: Math.round(duration * sampleRate),
          sampleRate,
        })
      )
    : new OfflineContext(channels, duration, sampleRate);

  const previousContext = getContext();
  setContext(offlineContext);
  try {
    await build(offlineContext);
  } finally {
    setContext(previousContext);
  }

  const toneBuffer = await offlineContext.render();
  const audioBuffer = toneBuffer.get();
  if (!audioBuffer) {
    throw new Error('Offline rendering produced no audio buffer');
  }
  return audioBuffer;
}
