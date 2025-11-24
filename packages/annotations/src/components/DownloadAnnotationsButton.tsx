import React from 'react';
import { BaseControlButton } from '@waveform-playlist/ui-components';
import { serializeAeneas } from '../parsers/aeneas';
import type { Annotation } from '../types';

export interface DownloadAnnotationsButtonProps {
  annotations: Annotation[];
  filename?: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const DownloadAnnotationsButton: React.FC<DownloadAnnotationsButtonProps> = ({
  annotations,
  filename = 'annotations.json',
  disabled = false,
  className,
  children = 'Download JSON',
}) => {
  const handleDownload = () => {
    if (annotations.length === 0) {
      return;
    }

    // Serialize annotations to Aeneas JSON format
    const jsonData = annotations.map(annotation => serializeAeneas(annotation));
    const jsonString = JSON.stringify(jsonData, null, 2);

    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <BaseControlButton
      variant="info"
      onClick={handleDownload}
      disabled={disabled || annotations.length === 0}
      className={className}
      title={annotations.length === 0 ? 'No annotations to download' : 'Download the annotations as JSON'}
    >
      {children}
    </BaseControlButton>
  );
};
