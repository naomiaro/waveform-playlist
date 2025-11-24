import 'styled-components';
import { WaveformPlaylistTheme } from './wfpl-theme';

declare module 'styled-components' {
  export interface DefaultTheme extends WaveformPlaylistTheme {}
}
