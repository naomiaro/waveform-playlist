import React from 'react';
import { BaseControlButton } from '@waveform-playlist/ui-components';
import { usePlaylistTimeline, usePlaylistMixer } from '../contexts/playlistContexts';
import {
  useExportWav,
  type ExportResult,
  type OfflineEffectsFunction,
  type OfflineTrackEffectsFunction,
} from '../hooks/useExportWav';

export interface ExportWavButtonProps {
  /** Button label */
  label?: string;
  /**
   * Filename for the downloaded file (without extension). A single track's file
   * is named `<filename>_<track name>`.
   */
  filename?: string;
  /**
   * The id of the one track to export. Left out, the mix of the audible tracks
   * is exported (two channels when any of them is stereo, else one). Given,
   * that track alone, as it sounds on its own: its mute and the other tracks'
   * solo are ignored, and the master chain (`effectsFunction`) applies too.
   */
  trackId?: string;
  /** Bit depth: 16 or 32 */
  bitDepth?: 16 | 32;
  /**
   * Optional effects function for master effects. When provided, export renders
   * through the effects chain (WAM entries included). May be async. Clip fades
   * are always rendered.
   */
  effectsFunction?: OfflineEffectsFunction;
  /**
   * Optional function to create offline track effects.
   * Takes a trackId and returns an offline effects function for that track.
   */
  createOfflineTrackEffects?: (trackId: string) => OfflineTrackEffectsFunction | undefined;
  /** CSS class name */
  className?: string;
  /** Callback when export completes */
  onExportComplete?: (blob: Blob) => void;
  /**
   * Callback when export fails. Without it, the failure is written to the
   * console with `console.error`. A throw from `onExportComplete` is not a
   * failed export: it is the app's own error, an unhandled rejection.
   */
  onExportError?: (error: Error) => void;
}

export const ExportWavButton: React.FC<ExportWavButtonProps> = ({
  label = 'Export WAV',
  filename = 'export',
  trackId,
  bitDepth = 16,
  effectsFunction,
  createOfflineTrackEffects,
  className,
  onExportComplete,
  onExportError,
}) => {
  const { tracks } = usePlaylistTimeline();
  const { trackStates } = usePlaylistMixer();
  const { exportWav, isExporting, progress } = useExportWav();

  const handleExport = async () => {
    let result: ExportResult;
    try {
      result = await exportWav(tracks, trackStates, {
        filename,
        trackId,
        bitDepth,
        effectsFunction,
        createOfflineTrackEffects,
        autoDownload: true,
      });
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      if (onExportError) {
        onExportError(failure);
      } else {
        // The error itself as the second argument: its stack and `cause` stay.
        console.error(
          '[waveform-playlist] The WAV export failed. ' +
            'Pass `onExportError` to ExportWavButton to show this in your app.',
          failure
        );
      }
      return;
    }
    // Outside the try: a throw from the app's own callback is not a failed export.
    onExportComplete?.(result.blob);
  };

  const buttonLabel = isExporting ? `Exporting ${Math.round(progress * 100)}%` : label;

  return (
    <BaseControlButton
      onClick={handleExport}
      disabled={isExporting || tracks.length === 0}
      className={className}
    >
      {buttonLabel}
    </BaseControlButton>
  );
};
