import { Gain } from 'tone';
import type { TrackEffectsFunction } from './ToneTrack';

/**
 * Effects wiring for the MIDI half of a mixed audio+MIDI track.
 *
 * A mixed track is TWO playout tracks (`id` and `id:midi`) but has ONE
 * effects chain. With pre-fader effects (#660) a chain returns into a
 * channel strip, so the two halves cannot each run the track's effects
 * closure: the shared chain's output would be connected to both faders and
 * the whole track would play twice (+6 dB).
 *
 * Instead only the audio half runs the closure, and the MIDI half's voices
 * are summed into the audio half's pre-fader input: one chain, one strip.
 * The MIDI half's own volume/pan/mute then carry no signal (the adapter
 * mirrors every control to both halves, so the audio half's strip already
 * holds the same settings).
 *
 * Level: MIDI voices are mono. Through a MONO audio half's pan stage they
 * get the mono pan law, as on their own strip. A STEREO audio half uses the
 * stereo law (unity at centre, where the mono law gives 1/√2), so the voices
 * are trimmed by 1/√2 to keep their centre level; panned off-centre they sit
 * up to 3 dB above the mono law, since the two laws differ.
 */
export function mixedTrackMidiEffects(
  audioHalfInput: Gain,
  audioHalfIsStereo: boolean
): TrackEffectsFunction {
  return (midiInput) => {
    if (!audioHalfIsStereo) {
      midiInput.connect(audioHalfInput);
      return undefined;
    }
    const trim = new Gain({ gain: Math.SQRT1_2 });
    midiInput.connect(trim);
    trim.connect(audioHalfInput);
    return () => {
      trim.dispose();
    };
  };
}
