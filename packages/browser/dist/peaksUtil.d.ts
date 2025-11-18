import { type PeakData } from '@waveform-playlist/webaudio-peaks';
/**
 * Generate peaks from an AudioBuffer for waveform visualization
 * This is a thin wrapper around the webaudio-peaks package
 */
export declare function generatePeaks(audioBuffer: AudioBuffer, samplesPerPixel?: number, bits?: 8 | 16 | 32): PeakData;
//# sourceMappingURL=peaksUtil.d.ts.map