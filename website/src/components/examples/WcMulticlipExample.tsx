import { useEffect, useRef, useState } from 'react';
import '@dawcore/components';
import { NativePlayoutAdapter } from '@dawcore/transport';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'daw-editor': any;
      'daw-track': any;
      'daw-clip': any;
      'daw-keyboard-shortcuts': any;
      'daw-transport': any;
      'daw-play-button': any;
      'daw-pause-button': any;
      'daw-stop-button': any;
    }
  }
}

const ZOOM_LEVELS = [128, 256, 512, 1024, 2048, 4096, 8192];

const TRACKS = [
  {
    name: 'Kick',
    clips: [
      { src: '01_Kick', start: 0, duration: 8, offset: 0 },
      { src: '01_Kick', start: 12, duration: 8, offset: 8 },
    ],
  },
  {
    name: 'HiHat',
    clips: [{ src: '02_HiHat1', start: 4, duration: 12, offset: 4 }],
  },
  {
    name: 'Claps',
    clips: [
      { src: '04_Claps', start: 8, duration: 4, offset: 0 },
      { src: '04_Claps', start: 16, duration: 4, offset: 4 },
    ],
  },
  {
    name: 'Shakers',
    clips: [
      { src: '07_Shakers', start: 0, duration: 6, offset: 0 },
      { src: '07_Shakers', start: 10, duration: 6, offset: 6 },
    ],
  },
  {
    name: 'Bass',
    clips: [{ src: '08_Bass', start: 0, duration: 20, offset: 0 }],
  },
  {
    name: 'Synth 1',
    clips: [
      { src: '09_Synth1_Unmodulated', start: 4, duration: 8, offset: 2 },
      { src: '09_Synth1_Unmodulated', start: 14, duration: 6, offset: 10 },
    ],
  },
  {
    name: 'Synth 2',
    clips: [
      { src: '11_Synth2', start: 0, duration: 4, offset: 0 },
      { src: '11_Synth2', start: 8, duration: 4, offset: 4 },
      { src: '11_Synth2', start: 16, duration: 4, offset: 8 },
    ],
  },
];

const audioPath = (src: string, ext: string) =>
  `/waveform-playlist/media/audio/AlbertKader_Ubiquitous/${src}.${ext}`;

export default function WcMulticlipExample() {
  const editorRef = useRef<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(1024);

  useEffect(() => {
    const editor = editorRef.current as any;
    if (!editor) return;
    const ctx = new AudioContext({ sampleRate: 48000 });
    editor.adapter = new NativePlayoutAdapter(ctx);
    return () => {
      ctx.close().catch(() => {});
    };
  }, []);

  const handleZoom = (direction: 1 | -1) => {
    const editor = editorRef.current as any;
    if (!editor) return;
    const idx = ZOOM_LEVELS.indexOf(editor.samplesPerPixel);
    const next = idx + direction;
    if (next < 0 || next >= ZOOM_LEVELS.length) return;
    editor.samplesPerPixel = ZOOM_LEVELS[next];
    setZoom(ZOOM_LEVELS[next]);
  };

  return (
    <div>
      <daw-editor
        ref={editorRef}
        id="wc-multiclip-editor"
        samples-per-pixel="1024"
        wave-height="80"
        timescale
        clip-headers
        interactive-clips
        style={{ display: 'block', marginBottom: '0.75rem' }}
      >
        <daw-keyboard-shortcuts playback splitting undo />
        {TRACKS.map((track) => (
          <daw-track key={track.name} name={track.name}>
            {track.clips.map((clip, i) => (
              <daw-clip
                key={`${track.name}-${i}`}
                src={audioPath(clip.src, 'opus')}
                peaks-src={audioPath(clip.src, 'dat')}
                start={clip.start}
                duration={clip.duration}
                offset={clip.offset}
              />
            ))}
          </daw-track>
        ))}
      </daw-editor>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <daw-transport for="wc-multiclip-editor" style={{ display: 'contents' }}>
          <daw-play-button />
          <daw-pause-button />
          <daw-stop-button />
        </daw-transport>
        <span style={{ width: '1px', alignSelf: 'stretch', background: 'var(--ifm-color-emphasis-300)' }} />
        <button onClick={() => handleZoom(-1)}>+</button>
        <button onClick={() => handleZoom(1)}>−</button>
        <code style={{ fontSize: '0.85rem', color: 'var(--ifm-color-emphasis-600)' }}>
          {zoom} spp
        </code>
      </div>
    </div>
  );
}
