import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { Bits } from '@waveform-playlist/core';
import { getGlobalContext } from '@waveform-playlist/playout';
import { recordingProcessorUrl } from '@waveform-playlist/worklets';
import { appendPeaks, concatenateAudioData, createAudioBuffer } from '@waveform-playlist/recording';
import type {
  DawRecordingStartDetail,
  DawRecordingCompleteDetail,
  DawRecordingErrorDetail,
} from '../events';

export interface RecordingOptions {
  trackId?: string;
  bits?: 8 | 16;
  startSample?: number;
}

export interface RecordingSession {
  readonly trackId: string;
  readonly stream: MediaStream;
  readonly source: { disconnect(): void; connect(dest: unknown): void };
  readonly workletNode: { port: MessagePort; disconnect(): void };
  readonly chunks: Float32Array[][];
  totalSamples: number;
  readonly peaks: (Int8Array | Int16Array)[];
  readonly startSample: number;
  readonly channelCount: number;
  readonly bits: Bits;
  isFirstMessage: boolean;
  /** Stored so it can be removed on stop/cleanup — not just when stream ends. */
  readonly _onTrackEnded: (() => void) | null;
  readonly _audioTrack: MediaStreamTrack | null;
}

/** Readonly view of a recording session for external consumers. */
export type ReadonlyRecordingSession = Readonly<
  Omit<RecordingSession, 'chunks' | 'peaks' | '_onTrackEnded' | '_audioTrack'>
> & {
  readonly chunks: ReadonlyArray<ReadonlyArray<Float32Array>>;
  readonly peaks: ReadonlyArray<Int8Array | Int16Array>;
};

/** Narrow interface for the host editor. */
export interface RecordingHost extends ReactiveControllerHost {
  readonly samplesPerPixel: number;
  readonly effectiveSampleRate: number;
  readonly _selectedTrackId: string | null;
  readonly _currentTime: number;
  readonly shadowRoot: ShadowRoot | null;
  resolveAudioContextSampleRate(rate: number): void;
  _addRecordedClip?(
    trackId: string,
    buf: AudioBuffer,
    startSample: number,
    durSamples: number
  ): void;
  dispatchEvent(event: Event): boolean;
}

export class RecordingController implements ReactiveController {
  private _host: RecordingHost & HTMLElement;
  private _sessions = new Map<string, RecordingSession>();
  private _workletLoaded = false;

  constructor(host: RecordingHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  hostConnected() {}

  hostDisconnected() {
    for (const trackId of [...this._sessions.keys()]) {
      this._cleanupSession(trackId);
    }
  }

  get isRecording(): boolean {
    return this._sessions.size > 0;
  }

  getSession(trackId: string): ReadonlyRecordingSession | undefined {
    return this._sessions.get(trackId);
  }

  async startRecording(stream: MediaStream, options: RecordingOptions = {}): Promise<void> {
    const trackId = options.trackId ?? this._host._selectedTrackId;
    if (!trackId) {
      console.warn('[dawcore] RecordingController: No track selected for recording');
      return;
    }
    if (this._sessions.has(trackId)) {
      console.warn('[dawcore] RecordingController: Already recording on track "' + trackId + '"');
      return;
    }

    const bits: Bits = options.bits ?? 16;
    const context = getGlobalContext();
    const rawCtx = context.rawContext as AudioContext;

    // Resolve editor sample rate from AudioContext before computing startSample
    this._host.resolveAudioContextSampleRate(rawCtx.sampleRate);

    try {
      // Load worklet via native API (not Tone.js addAudioWorkletModule — caches single URL)
      if (!this._workletLoaded) {
        await rawCtx.audioWorklet.addModule(recordingProcessorUrl);
        this._workletLoaded = true;
      }

      // Detect channel count from stream (not source.channelCount — defaults to 2)
      const channelCount = stream.getAudioTracks()[0]?.getSettings()?.channelCount ?? 1;

      const startSample =
        options.startSample ?? Math.floor(this._host._currentTime * this._host.effectiveSampleRate);

      // Use Tone.js Context methods — avoids standardized-audio-context identity issues
      const source = context.createMediaStreamSource(stream);
      const workletNode = context.createAudioWorkletNode('recording-processor', {
        channelCount,
        channelCountMode: 'explicit' as globalThis.ChannelCountMode,
      });

      // Listen on MediaStreamTrack (not MediaStream — MediaStream has no 'ended' event)
      const audioTrack = stream.getAudioTracks()[0] ?? null;
      const onTrackEnded = audioTrack
        ? () => {
            if (this._sessions.has(trackId)) {
              this.stopRecording(trackId);
            }
          }
        : null;

      const session: RecordingSession = {
        trackId,
        stream,
        source,
        workletNode,
        chunks: Array.from({ length: channelCount }, () => []),
        totalSamples: 0,
        peaks: Array.from({ length: channelCount }, () =>
          bits === 8 ? new Int8Array(0) : new Int16Array(0)
        ),
        startSample,
        channelCount,
        bits,
        isFirstMessage: true,
        _onTrackEnded: onTrackEnded,
        _audioTrack: audioTrack,
      };
      this._sessions.set(trackId, session);

      // dawcore CLAUDE.md: wire onmessage BEFORE source.connect() and postMessage start
      workletNode.port.onmessage = (e: MessageEvent) => {
        this._onWorkletMessage(trackId, e.data);
      };
      source.connect(workletNode);
      workletNode.port.postMessage({ command: 'start', channelCount });

      // Attach mic-unplug listener (stored in session for cleanup)
      if (audioTrack && onTrackEnded) {
        audioTrack.addEventListener('ended', onTrackEnded);
      }

      this._host.dispatchEvent(
        new CustomEvent<DawRecordingStartDetail>('daw-recording-start', {
          bubbles: true,
          composed: true,
          detail: { trackId, stream },
        })
      );

      this._host.requestUpdate();
    } catch (err) {
      // Clean up partially-created session to prevent stuck isRecording state
      this._cleanupSession(trackId);
      console.warn('[dawcore] RecordingController: Failed to start recording: ' + String(err));
      this._host.dispatchEvent(
        new CustomEvent<DawRecordingErrorDetail>('daw-recording-error', {
          bubbles: true,
          composed: true,
          detail: { trackId, error: err },
        })
      );
    }
  }

  stopRecording(trackId?: string): void {
    const id = trackId ?? [...this._sessions.keys()][0];
    if (!id) return;

    const session = this._sessions.get(id);
    if (!session) return;

    // Send stop BEFORE disconnect so worklet can flush remaining buffered samples
    session.workletNode.port.postMessage({ command: 'stop' });
    session.source.disconnect();
    session.workletNode.disconnect();

    // Remove mic-unplug listener (fix #4: prevent leak on normal stop path)
    this._removeTrackEndedListener(session);

    // Build AudioBuffer from accumulated chunks
    if (session.totalSamples === 0) {
      console.warn('[dawcore] RecordingController: No audio data captured');
      this._sessions.delete(id);
      this._host.requestUpdate();
      // Dispatch error so record button can reset its state (fix #3)
      this._host.dispatchEvent(
        new CustomEvent<DawRecordingErrorDetail>('daw-recording-error', {
          bubbles: true,
          composed: true,
          detail: { trackId: id, error: new Error('No audio data captured') },
        })
      );
      return;
    }
    const stopCtx = getGlobalContext().rawContext as AudioContext;
    const channelData = session.chunks.map((chunkArr) => concatenateAudioData(chunkArr));
    const audioBuffer = createAudioBuffer(
      stopCtx,
      channelData,
      this._host.effectiveSampleRate,
      session.channelCount
    );
    const durationSamples = audioBuffer.length;

    // Dispatch cancelable event
    const event = new CustomEvent<DawRecordingCompleteDetail>('daw-recording-complete', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: {
        trackId: id,
        audioBuffer,
        startSample: session.startSample,
        durationSamples,
      },
    });
    const notPrevented = this._host.dispatchEvent(event);

    // Clean up session
    this._sessions.delete(id);
    this._host.requestUpdate();

    if (notPrevented) {
      this._createClipFromRecording(id, audioBuffer, session.startSample, durationSamples);
    }
  }

  // Session fields are mutated in place on the hot path (~60fps worklet messages).
  // This is intentional — creating new session objects + Map entries per message
  // would cause significant GC pressure. Mutations are confined to the controller's
  // private map and do not affect Lit's reactive rendering.
  private _onWorkletMessage(trackId: string, data: unknown) {
    const session = this._sessions.get(trackId);
    if (!session) return;

    const { channels } = data as { channels: Float32Array[] };
    if (!channels || channels.length === 0 || !channels[0]) return;

    // Capture pre-increment value for appendPeaks
    const samplesProcessedBefore = session.totalSamples;

    // Accumulate chunks per channel
    for (let ch = 0; ch < session.channelCount; ch++) {
      if (channels[ch]) {
        session.chunks[ch].push(channels[ch]);
      }
    }
    session.totalSamples += channels[0].length;

    // Generate peaks per channel and update live preview waveforms
    for (let ch = 0; ch < session.channelCount; ch++) {
      if (!channels[ch]) continue;
      const oldPeakCount = Math.floor(session.peaks[ch].length / 2);
      (session.peaks as (Int8Array | Int16Array)[])[ch] = appendPeaks(
        session.peaks[ch],
        channels[ch],
        this._host.samplesPerPixel,
        samplesProcessedBefore,
        session.bits
      );
      const newPeakCount = Math.floor(session.peaks[ch].length / 2);

      // Update live preview waveform — host is already & HTMLElement so shadowRoot is typed
      const waveformSelector = `daw-waveform[data-recording-track="${trackId}"][data-recording-channel="${ch}"]`;
      const waveformEl = this._host.shadowRoot?.querySelector(waveformSelector) as any;
      if (waveformEl) {
        if (session.isFirstMessage) {
          waveformEl.peaks = session.peaks[ch];
        } else {
          waveformEl.setPeaksQuiet(session.peaks[ch]);
          waveformEl.updatePeaks(Math.max(0, oldPeakCount - 1), newPeakCount);
        }
      }
    }

    session.isFirstMessage = false;

    // Throttle requestUpdate — only when container width needs to grow
    const newPixelWidth = Math.floor(session.totalSamples / this._host.samplesPerPixel);
    const oldPixelWidth = Math.floor(
      (session.totalSamples - channels[0].length) / this._host.samplesPerPixel
    );
    if (newPixelWidth > oldPixelWidth) {
      this._host.requestUpdate();
    }
  }

  private _createClipFromRecording(
    trackId: string,
    audioBuffer: AudioBuffer,
    startSample: number,
    durationSamples: number
  ) {
    if (typeof this._host._addRecordedClip === 'function') {
      this._host._addRecordedClip(trackId, audioBuffer, startSample, durationSamples);
    } else {
      console.warn(
        '[dawcore] RecordingController: host does not implement _addRecordedClip — clip not created for track "' +
          trackId +
          '"'
      );
    }
  }

  private _removeTrackEndedListener(session: RecordingSession) {
    if (session._audioTrack && session._onTrackEnded) {
      session._audioTrack.removeEventListener('ended', session._onTrackEnded);
    }
  }

  private _cleanupSession(trackId: string) {
    const session = this._sessions.get(trackId);
    if (!session) return;
    try {
      this._removeTrackEndedListener(session);
      session.workletNode.port.postMessage({ command: 'stop' });
      session.source.disconnect();
      session.workletNode.disconnect();
    } catch (err) {
      console.warn(
        '[dawcore] RecordingController: disconnect error during cleanup for track "' +
          trackId +
          '": ' +
          String(err)
      );
    }
    this._sessions.delete(trackId);
  }
}
