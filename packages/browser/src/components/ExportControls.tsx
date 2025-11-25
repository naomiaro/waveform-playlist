import React from 'react';
import { BaseControlButton } from '@waveform-playlist/ui-components';
import { usePlaylistData } from '../WaveformPlaylistContext';
import { useExportWav } from '../hooks/useExportWav';

export interface ExportWavButtonProps {
  /** Button label */
  label?: string;
  /** Filename for the downloaded file (without extension) */
  filename?: string;
  /** Export mode: 'master' for stereo mix, 'individual' for single track */
  mode?: 'master' | 'individual';
  /** Track index for individual export */
  trackIndex?: number;
  /** Bit depth: 16 or 32 */
  bitDepth?: 16 | 32;
  /** Whether to apply effects (fades, etc.) - defaults to true */
  applyEffects?: boolean;
  /** CSS class name */
  className?: string;
  /** Callback when export completes */
  onExportComplete?: (blob: Blob) => void;
  /** Callback when export fails */
  onExportError?: (error: Error) => void;
}

export const ExportWavButton: React.FC<ExportWavButtonProps> = ({
  label = 'Export WAV',
  filename = 'export',
  mode = 'master',
  trackIndex,
  bitDepth = 16,
  applyEffects = true,
  className,
  onExportComplete,
  onExportError,
}) => {
  const { tracks, trackStates } = usePlaylistData();
  const { exportWav, isExporting, progress } = useExportWav();

  const handleExport = async () => {
    try {
      const result = await exportWav(tracks, trackStates, {
        filename,
        mode,
        trackIndex,
        bitDepth,
        applyEffects,
        autoDownload: true,
      });
      onExportComplete?.(result.blob);
    } catch (error) {
      onExportError?.(error instanceof Error ? error : new Error('Export failed'));
    }
  };

  const buttonLabel = isExporting
    ? `Exporting ${Math.round(progress * 100)}%`
    : label;

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
