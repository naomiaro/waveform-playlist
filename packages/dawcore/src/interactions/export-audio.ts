import { createEffectInstance } from '../effects/effect-registry';
import type { SerializedEffectEntry } from '../effects/types';

const PREFIX = '[waveform-playlist] ';

export interface ExportOptions {
  /** Default: the host's sample rate. */
  sampleRate?: number;
  /** Window start in seconds. Default: 0. */
  startTime?: number;
  /** Window length in seconds. Default: host duration minus startTime. */
  duration?: number;
  /** Default: 2 (stereo). */
  channels?: 1 | 2;
}

interface ExportClip {
  startSample: number;
  durationSamples: number;
  offsetSamples: number;
  sampleRate: number;
  gain?: number;
  audioBuffer?: AudioBuffer;
}

interface ExportTrack {
  id: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  clips: ExportClip[];
}

/** What the editor provides to the export pipeline. */
export interface ExportAudioHost {
  effectiveSampleRate: number;
  /** Natural session duration in seconds. */
  duration: number;
  tracks: ExportTrack[];
  getMasterEffectsState(): Promise<SerializedEffectEntry[]>;
  getTrackEffectsState(trackId: string): Promise<SerializedEffectEntry[]>;
}

interface OfflineChain {
  input: AudioNode;
  output: AudioNode;
  dispose: () => void;
}

/**
 * Render the session offline through all effect chains (per-track + master).
 *
 * No Transport involved: clips are known upfront, so sources are scheduled
 * statically on an OfflineAudioContext. Effect chains rebuild from their
 * persisted form (#424) — natives via the registry (definitions take
 * BaseAudioContext for exactly this), WAM plugins re-instantiated on the
 * offline context with their saved state (worklets are context-bound, the
 * wam-studio cloneInto pattern). All offline plugin instances are destroyed
 * after rendering, success or failure.
 *
 * Parity note: clip fades are not rendered — the native ClipPlayer does not
 * apply them during playback either.
 */
export async function exportAudioImpl(
  host: ExportAudioHost,
  options: ExportOptions = {}
): Promise<AudioBuffer> {
  const sampleRate = options.sampleRate ?? host.effectiveSampleRate;
  const startTime = options.startTime ?? 0;
  const duration = options.duration ?? Math.max(0, host.duration - startTime);
  const channels = options.channels ?? 2;
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(PREFIX + 'exportAudio: invalid sampleRate ' + String(sampleRate));
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(PREFIX + 'exportAudio: nothing to render (duration ' + String(duration) + ')');
  }

  const ctx = new OfflineAudioContext({
    numberOfChannels: channels,
    length: Math.round(duration * sampleRate),
    sampleRate,
  });

  const cleanups: Array<() => void> = [];
  try {
    const masterChain = await buildOfflineChain(ctx, await host.getMasterEffectsState());
    cleanups.push(masterChain.dispose);
    masterChain.output.connect(ctx.destination);

    const anySoloed = host.tracks.some((t) => t.soloed);
    for (const track of host.tracks) {
      if (track.muted || (anySoloed && !track.soloed)) {
        continue;
      }
      const chain = await buildOfflineChain(ctx, await host.getTrackEffectsState(track.id));
      cleanups.push(chain.dispose);

      const volume = ctx.createGain();
      volume.gain.value = track.volume;
      const panner = ctx.createStereoPanner();
      panner.pan.value = track.pan;
      volume.connect(panner);
      panner.connect(chain.input);
      chain.output.connect(masterChain.input);

      for (const clip of track.clips) {
        scheduleClip(ctx, clip, startTime, duration, volume);
      }
    }

    return await ctx.startRendering();
  } finally {
    for (const dispose of cleanups) {
      try {
        dispose();
      } catch (err) {
        console.warn(PREFIX + 'exportAudio: cleanup error: ' + String(err));
      }
    }
  }
}

/** Schedule one clip's source into the render window, clamping at both edges. */
function scheduleClip(
  ctx: OfflineAudioContext,
  clip: ExportClip,
  windowStart: number,
  windowDuration: number,
  destination: AudioNode
): void {
  if (!clip.audioBuffer || clip.durationSamples <= 0) {
    return;
  }
  const clipRate = clip.sampleRate;
  const clipStart = clip.startSample / clipRate;
  const clipDuration = clip.durationSamples / clipRate;
  let offset = clip.offsetSamples / clipRate;

  let when = clipStart - windowStart;
  let remaining = clipDuration;
  if (when < 0) {
    // Window begins mid-clip: start immediately, further into the file.
    offset += -when;
    remaining += when;
    when = 0;
  }
  remaining = Math.min(remaining, windowDuration - when);
  if (remaining <= 0) {
    return;
  }

  const source = ctx.createBufferSource();
  source.buffer = clip.audioBuffer;
  let out: AudioNode = source;
  if (clip.gain !== undefined && clip.gain !== 1) {
    const gainNode = ctx.createGain();
    gainNode.gain.value = clip.gain;
    out.connect(gainNode);
    out = gainNode;
  }
  out.connect(destination);
  source.start(when, offset, remaining);
}

/**
 * Rebuild a persisted effects chain on the offline context.
 * Bypass parity with live playback: wet-style entries are created with their
 * wet zeroed; disconnect-style entries (including bypassed WAM plugins and
 * placeholders) are skipped from the series entirely.
 */
async function buildOfflineChain(
  ctx: OfflineAudioContext,
  entries: SerializedEffectEntry[]
): Promise<OfflineChain> {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const cleanups: Array<() => void> = [];
  const dispose = (): void => {
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch (err) {
        console.warn(PREFIX + 'exportAudio: chain cleanup error: ' + String(err));
      }
    }
  };
  let previous: AudioNode = input;

  try {
    await wireEntries();
  } catch (err) {
    // A failure partway through must not leak the plugin worklets already
    // created for this chain — the caller never gets a dispose handle for a
    // chain that threw.
    dispose();
    throw err;
  }

  previous.connect(output);
  return { input, output, dispose };

  async function wireEntries(): Promise<void> {
    for (const entry of entries) {
      if (entry.kind === 'native') {
        const created = createEffectInstance(entry.type, ctx, entry.params);
        if (entry.bypassed) {
          if (!created.wetParam) {
            created.instance.dispose?.();
            continue; // disconnect-style bypass: out of the series
          }
          created.instance.applyParams({ [created.wetParam]: 0 });
        }
        if (created.instance.dispose) {
          cleanups.push(created.instance.dispose);
        }
        previous.connect(created.instance.input);
        previous = created.instance.output;
        continue;
      }

      // kind 'wam'
      if (entry.bypassed) {
        continue; // disconnection bypass — also covers restore placeholders
      }
      const wamModule = await import('@dawcore/wam');
      const { hostGroupId } = await wamModule.ensureWamHost(ctx);
      const plugin = await wamModule.createWamInstance(entry.url, ctx, hostGroupId, {
        initialState: entry.state,
      });
      cleanups.push(() => plugin.destroy());
      previous.connect(plugin.audioNode);
      previous = plugin.audioNode;
    }
  }
}
