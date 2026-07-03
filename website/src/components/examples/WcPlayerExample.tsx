import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import '@dawcore/components';
import styles from './wc-example.module.css';

// Custom-element JSX typing requires augmenting the global JSX namespace.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'daw-player': {
        ref?: RefObject<DawPlayerElement | null>;
        src?: string;
        'peaks-src'?: string;
        'wave-height'?: string | number;
        timescale?: boolean;
        class?: string;
      };
    }
  }
}

const BASE = '/waveform-playlist/media/audio';

/** Imperative surface of <daw-player> used by this demo. */
interface DawPlayerElement extends HTMLElement {
  play(): void;
  pause(): void;
  stop(): void;
  setPlaybackRate(rate: number): void;
  duration: number;
  currentTime: number;
}

const RATES = [0.75, 1, 1.25, 1.5];

export default function WcPlayerExample() {
  const waveformRef = useRef<DawPlayerElement | null>(null);
  const scrubberRef = useRef<DawPlayerElement | null>(null);
  const timeRef = useRef<HTMLElement | null>(null);
  const eventRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const player = waveformRef.current;
    if (!player) return;

    // daw-timeupdate fires per animation frame — write to the DOM directly,
    // never setState at 60fps.
    const onTime = (e: Event) => {
      const { time } = (e as CustomEvent<{ time: number }>).detail;
      if (timeRef.current) timeRef.current.textContent = time.toFixed(2) + 's';
    };
    const showEvent = (e: Event) => {
      if (!eventRef.current) return;
      const duration =
        e.type === 'daw-ready' ? ' (duration ' + player.duration.toFixed(2) + 's)' : '';
      eventRef.current.textContent = e.type + duration;
      // No daw-timeupdate frames fire once stopped/paused — sync the readout
      // here so Stop's rewind to 0 is visible.
      if (timeRef.current) timeRef.current.textContent = player.currentTime.toFixed(2) + 's';
    };

    player.addEventListener('daw-timeupdate', onTime);
    const logged = ['daw-ready', 'daw-play', 'daw-pause', 'daw-stop', 'daw-ended'];
    logged.forEach((type) => player.addEventListener(type, showEvent));
    return () => {
      player.removeEventListener('daw-timeupdate', onTime);
      logged.forEach((type) => player.removeEventListener(type, showEvent));
    };
  }, []);

  return (
    <>
      <h3>
        With a waveform (<code>peaks-src</code>)
      </h3>
      <daw-player
        ref={waveformRef}
        src={`${BASE}/AlbertKader_Whiptails/01_Loop1.opus`}
        peaks-src={`${BASE}/AlbertKader_Whiptails/01_Loop1.dat`}
        wave-height="96"
        timescale
        class={styles.player}
      />
      <div className={styles.playerControls}>
        <button type="button" onClick={() => waveformRef.current?.play()}>
          Play
        </button>
        <button type="button" onClick={() => waveformRef.current?.pause()}>
          Pause
        </button>
        <button type="button" onClick={() => waveformRef.current?.stop()}>
          Stop
        </button>
        <label>
          Rate{' '}
          <select
            defaultValue="1"
            onChange={(e) => waveformRef.current?.setPlaybackRate(Number(e.target.value))}
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </label>
        <code ref={timeRef}>0.00s</code>
        <code ref={eventRef} className={styles.playerEvent}>
          —
        </code>
      </div>

      <h3>
        Scrubber fallback (no <code>peaks-src</code>)
      </h3>
      <daw-player
        ref={scrubberRef}
        src={`${BASE}/sonnet.mp3`}
        wave-height="64"
        class={styles.playerAlt}
      />
      <div className={styles.playerControls}>
        <button type="button" onClick={() => scrubberRef.current?.play()}>
          Play
        </button>
        <button type="button" onClick={() => scrubberRef.current?.pause()}>
          Pause
        </button>
        <button type="button" onClick={() => scrubberRef.current?.stop()}>
          Stop
        </button>
      </div>
    </>
  );
}
