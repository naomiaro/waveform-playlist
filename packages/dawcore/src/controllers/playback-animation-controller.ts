import type { ReactiveControllerHost } from 'lit';
import { AnimationController } from './animation-controller';
import type { DawTimeUpdateDetail } from '../events';

export interface PlayheadLike {
  setPosition(px: number): void;
}

/**
 * The single editor-owned playback animation loop (mirror of the React
 * `usePlaybackAnimation` pattern). Each frame reads the latency-compensated
 * playback time ONCE, positions the playhead, and dispatches `daw-timeupdate`
 * from the host element. External consumers hook into the same loop by
 * listening for `daw-timeupdate` — never add a second RAF loop for
 * playback-time concerns.
 *
 * HTMLMediaElement-adjacent: `stop()` dispatches one final event so idle
 * displays settle on the exact commanded position (media elements fire
 * `timeupdate` on pause and seek too).
 */
export class PlaybackAnimationController {
  private _animation: AnimationController;
  private _host: ReactiveControllerHost & HTMLElement;
  private _running = false;
  private _lastDispatchedTime: number | null = null;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    this._animation = new AnimationController(host);
  }

  start(
    getTime: () => number,
    timeToPixels: (time: number) => number,
    getPlayhead: () => PlayheadLike | null
  ): void {
    this._running = true;
    this._animation.start(() => {
      const time = getTime();
      getPlayhead()?.setPosition(timeToPixels(time));
      this._dispatchTimeUpdate(time);
    });
  }

  stop(
    finalTime: number,
    timeToPixels: (time: number) => number,
    getPlayhead: () => PlayheadLike | null
  ): void {
    // The editor's stop path reaches here twice (the engine 'stop' handler
    // registered in _buildEngine AND editor.stop() both call _stopPlayhead).
    // Dedupe: dispatch only when the loop was actually running or the settled
    // time changed (seek-while-stopped must still fire its event).
    const wasRunning = this._running;
    this._running = false;
    this._animation.stop();
    getPlayhead()?.setPosition(timeToPixels(finalTime));
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
