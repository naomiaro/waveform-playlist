import type { ReactiveControllerHost } from 'lit';
import { AnimationController } from './animation-controller';
import type { DawTimeUpdateDetail } from '../events';

export interface PlayheadLike {
  setPosition(px: number): void;
}

export interface PlaybackAnimationOptions {
  /** Convert playback seconds to a timeline pixel offset. */
  timeToPixels: (time: number) => number;
  /** Resolve the playhead element (re-queried per call — templates may recreate it). */
  getPlayhead: () => PlayheadLike | null;
}

/**
 * The single editor-owned playback animation loop (mirror of the React
 * `usePlaybackAnimation` pattern). Each frame reads the latency-compensated
 * playback time ONCE, positions the playhead, and dispatches `daw-timeupdate`
 * from the host element. External consumers hook into the same loop by
 * listening for `daw-timeupdate` — never add a second RAF loop for
 * playback-time concerns.
 *
 * `timeToPixels` and `getPlayhead` are injected once at construction — they
 * are stable per host, and threading them through every `start`/`stop` call
 * invited desync between the two call sites.
 *
 * HTMLMediaElement-adjacent: `stop()` dispatches one final event so idle
 * displays settle on the exact commanded position (media elements fire
 * `timeupdate` on pause and seek too). Pass `{ dispatch: false }` for
 * transitional stops (stop+play seeks) whose settle position must not leak
 * to consumers.
 */
export class PlaybackAnimationController {
  private _animation: AnimationController;
  private _host: ReactiveControllerHost & HTMLElement;
  private _options: PlaybackAnimationOptions;
  private _running = false;
  private _lastDispatchedTime: number | null = null;

  constructor(host: ReactiveControllerHost & HTMLElement, options: PlaybackAnimationOptions) {
    this._host = host;
    this._options = options;
    this._animation = new AnimationController(host);
  }

  start(getTime: () => number): void {
    this._running = true;
    this._animation.start(() => {
      const time = getTime();
      this._options.getPlayhead()?.setPosition(this._options.timeToPixels(time));
      this._dispatchTimeUpdate(time);
    });
  }

  stop(finalTime: number, opts?: { dispatch?: boolean }): void {
    // The editor's stop path reaches here twice (the engine 'stop' handler
    // registered in _buildEngine AND editor.stop() both call _stopPlayhead).
    // Dedupe: dispatch only when the loop was actually running or the settled
    // time changed (seek-while-stopped must still fire its event).
    const wasRunning = this._running;
    this._running = false;
    this._animation.stop();
    this._options.getPlayhead()?.setPosition(this._options.timeToPixels(finalTime));
    // dispatch === false: transitional stop (seek-while-playing) — stop the
    // loop and position the playhead, but don't leak the settle time to
    // consumers; _lastDispatchedTime stays untouched so the dedupe logic
    // still reflects the last event consumers actually saw.
    if (opts?.dispatch === false) return;
    if (wasRunning || finalTime !== this._lastDispatchedTime) {
      this._dispatchTimeUpdate(finalTime);
    }
  }

  private _dispatchTimeUpdate(time: number): void {
    this._lastDispatchedTime = time;
    this._host.dispatchEvent(
      new CustomEvent<DawTimeUpdateDetail>('daw-timeupdate', {
        bubbles: true,
        composed: true,
        detail: { time },
      })
    );
  }
}
