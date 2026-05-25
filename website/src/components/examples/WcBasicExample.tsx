import { useEffect, useRef } from 'react';
import '@dawcore/components';
import { NativePlayoutAdapter } from '@dawcore/transport';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'daw-editor': any;
      'daw-track': any;
      'daw-transport': any;
      'daw-play-button': any;
      'daw-pause-button': any;
      'daw-stop-button': any;
    }
  }
}

const TRACKS = [
  { src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/03_Kick.opus', name: 'Kick' },
  { src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/05_Claps.opus', name: 'Claps' },
  { src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/06_HiHat.opus', name: 'HiHat' },
  { src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/07_Bass1.opus', name: 'Bass' },
  { src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/09_Synth1.opus', name: 'Synth' },
];

export default function WcBasicExample() {
  const editorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current as any;
    if (!editor) return;
    const ctx = new AudioContext({ sampleRate: 48000 });
    editor.adapter = new NativePlayoutAdapter(ctx);
    return () => {
      ctx.close().catch(() => {});
    };
  }, []);

  return (
    <div>
      <daw-editor
        ref={editorRef}
        id="wc-basic-editor"
        samples-per-pixel="1024"
        wave-height="100"
        timescale
        style={{ display: 'block', marginBottom: '0.75rem' }}
      >
        {TRACKS.map((t) => (
          <daw-track key={t.src} src={t.src} name={t.name} />
        ))}
      </daw-editor>
      <daw-transport
        for="wc-basic-editor"
        style={{ display: 'flex', gap: '0.5rem' }}
      >
        <daw-play-button />
        <daw-pause-button />
        <daw-stop-button />
      </daw-transport>
    </div>
  );
}
