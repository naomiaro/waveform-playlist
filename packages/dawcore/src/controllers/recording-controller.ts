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
  trackId: string;
  stream: MediaStream;
  source: { disconnect(): void; connect(dest: any): void };
  workletNode: { port: MessagePort; disconnect(): void };
  chunks: Float32Array[][];
  totalSamples: number;
  peaks: (Int8Array | Int16Array)[];
  startSample: number;
  channelCount: number;
  bits: Bits;
  isFirstMessage: boolean;
}

/** Narrow interface for the host editor. */
export interface RecordingHost extends ReactiveControllerHost {
  readonly samplesPerPixel: number;
  readonly effectiveSampleRate: number;
  readonly _selectedTrackId: string | null;
  readonly _currentTime: number;
  resolveAudioContextSampleRate(rate: number): void;
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

  getSession(trackId: string): RecordingSession | undefined {
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
      };
      this._sessions.set(trackId, session);

      // Wire handler BEFORE connect and start (recording CLAUDE.md: reset refs before connect)
      workletNode.port.onmessage = (e: MessageEvent) => {
        this._onWorkletMessage(trackId, e.data);
      };
      source.connect(workletNode);
      workletNode.port.postMessage({ command: 'start', channelCount });

      // Handle stream ending (mic unplug)
      const onStreamEnded = () => {
        stream.removeEventListener('ended', onStreamEnded);
        if (this._sessions.has(trackId)) {
          this.stopRecording(trackId);
        }
      };
      stream.addEventListener('ended', onStreamEnded);

      this._host.dispatchEvent(
        new CustomEvent<DawRecordingStartDetail>('daw-recording-start', {
          bubbles: true,
          composed: true,
          detail: { trackId, stream },
        })
      );

      this._host.requestUpdate();
    } catch (err) {
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

    // Disconnect audio graph
    session.source.disconnect();
    session.workletNode.disconnect();
    session.workletNode.port.postMessage({ command: 'stop' });

    // Build AudioBuffer from accumulated chunks
    if (session.totalSamples === 0) {
      console.warn('[dawcore] RecordingController: No audio data captured');
      this._sessions.delete(id);
      this._host.requestUpdate();
      return;
    }
    const stopCtx = getGlobalContext().rawContext as AudioContext;
    const channelData = session.chunks.map((chunkArr) => concatenateAudioData(chunkArr));
    const audioBuffer = createAudioBuffer(
      stopCtx, channelData, this._host.effectiveSampleRate, session.channelCount
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

    // If not prevented, create clip (Task 6 will implement this)
    if (notPrevented) {
      this._createClipFromRecording(id, audioBuffer, session.startSample, durationSamples);
    }
  }

  private _onWorkletMessage(trackId: string, data: any) {
    const session = this._sessions.get(trackId);
    if (!session) return;

    const { channels } = data as { channels: Float32Array[] };
    if (!channels || channels.length === 0) return;

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
      session.peaks[ch] = appendPeaks(
        session.peaks[ch],
        channels[ch],
        this._host.samplesPerPixel,
        samplesProcessedBefore,
        session.bits
      );
      const newPeakCount = Math.floor(session.peaks[ch].length / 2);

      // Update live preview waveform
      const waveformSelector = `daw-waveform[data-recording-track="${trackId}"][data-recording-channel="${ch}"]`;
      const waveformEl = (this._host as any).shadowRoot?.querySelector(waveformSelector);
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
    const host = this._host as any;
    if (typeof host._addRecordedClip === 'function') {
      host._addRecordedClip(trackId, audioBuffer, startSample, durationSamples);
    }
  }

  private _cleanupSession(trackId: string) {
    const session = this._sessions.get(trackId);
    if (!session) return;
    try {
      session.source.disconnect();
      session.workletNode.disconnect();
    } catch {
      // Ignore disconnect errors on cleanup
    }
    this._sessions.delete(trackId);
  }
}
