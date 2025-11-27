import React from 'react';
import styled from 'styled-components';
import { serializeAeneas } from '../parsers/aeneas';
import type { Annotation } from '../types';

const StyledButton = styled.button`
  padding: 0.5rem 1rem;
  background: ${(props) => props.theme?.surfaceColor || '#f5f5f5'};
  color: ${(props) => props.theme?.textColor || '#333'};
  border: 1px solid ${(props) => props.theme?.borderColor || '#ccc'};
  border-radius: ${(props) => props.theme?.borderRadius || '4px'};
  cursor: pointer;
  font-family: ${(props) => props.theme?.fontFamily || 'inherit'};
  font-size: ${(props) => props.theme?.fontSize || '14px'};
  font-weight: 500;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: ${(props) => props.theme?.inputBackground || '#3d3d3d'};
    border-color: ${(props) => props.theme?.textColorMuted || '#999'};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${(props) => props.theme?.inputFocusBorder || '#007bff'}44;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

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
    <StyledButton
      onClick={handleDownload}
      disabled={disabled || annotations.length === 0}
      className={className}
      title={annotations.length === 0 ? 'No annotations to download' : 'Download the annotations as JSON'}
    >
      {children}
    </StyledButton>
  );
};
