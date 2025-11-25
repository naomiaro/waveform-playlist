import 'styled-components';
import { WaveformPlaylistTheme } from '@waveform-playlist/ui-components';

declare module 'styled-components' {
  export interface DefaultTheme extends WaveformPlaylistTheme {}
}
