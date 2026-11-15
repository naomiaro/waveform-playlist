/**
 * Shared file drop zone component used across example pages.
 * Supports drag-and-drop and click-to-browse with visual feedback.
 */

import React from 'react';
import styled from 'styled-components';
import { FolderOpenIcon, MusicNotesIcon } from '@phosphor-icons/react';

const Zone = styled.div<{ $isDragging: boolean }>`
  position: relative;
  padding: 1.5rem 1rem;
  border: 2px dashed
    ${(props) => (props.$isDragging ? '#3498db' : 'var(--ifm-color-emphasis-400, #ced4da)')};
  border-radius: 0.5rem;
  text-align: center;
  background: ${(props) =>
    props.$isDragging
      ? 'rgba(52, 152, 219, 0.1)'
      : 'var(--ifm-background-surface-color, #f8f9fa)'};
  transition: all 0.2s ease-in-out;
  cursor: pointer;

  &:hover {
    border-color: #3498db;
  }
`;

const ZoneText = styled.p`
  margin: 0;
  color: var(--ifm-font-color-base, #495057);
  font-size: 0.9rem;
`;

// The label and the loading content share one grid cell, so the zone is as
// tall as the larger of the two whichever is shown: a page whose loading text
// comes and goes does not move what is below the zone (a clip being dragged
// in an editor below would be left behind until the release).
const Stack = styled.div`
  display: grid;

  & > * {
    grid-area: 1 / 1;
  }
`;

const Layer = styled.div<{ $hidden?: boolean }>`
  visibility: ${(props) => (props.$hidden ? 'hidden' : 'visible')};
`;

const HiddenInput = styled.input`
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
`;

interface FileDropZoneProps {
  /** File accept string, e.g. "audio/*" or ".mid,.midi" */
  accept: string;
  /** Called with the selected/dropped files */
  onFiles: (files: File[]) => void;
  /** Optional filter predicate applied to dropped files */
  fileFilter?: (file: File) => boolean;
  /** Text shown when not dragging */
  label?: string;
  /** Text shown while dragging over */
  dragLabel?: string;
  /** Additional content below the drop zone (e.g. subtext) */
  children?: React.ReactNode;
  /** Shown instead of the label and children while `loading`; its space is kept when idle */
  loadingContent?: React.ReactNode;
  /** Whether `loadingContent` is shown */
  loading?: boolean;
  /** Additional CSS class */
  className?: string;
}

export function FileDropZone({
  accept,
  onFiles,
  fileFilter,
  label = 'Drop files here to add tracks, or click to browse',
  dragLabel = 'Drop files here',
  children,
  loadingContent,
  loading = false,
  className,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      let files: File[] = Array.from(e.dataTransfer.files);
      if (fileFilter) {
        files = files.filter(fileFilter);
      }
      if (files.length > 0) {
        onFiles(files);
      }
    },
    [onFiles, fileFilter]
  );

  const handleFileInput = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFiles(Array.from(e.target.files));
      }
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [onFiles]
  );

  const idle = (
    <>
      <ZoneText>
        {isDragging ? (
          <>
            <FolderOpenIcon
              size={18}
              weight="light"
              style={{ marginRight: 6, verticalAlign: 'text-bottom' }}
            />
            {dragLabel}
          </>
        ) : (
          <>
            <MusicNotesIcon
              size={18}
              weight="light"
              style={{ marginRight: 6, verticalAlign: 'text-bottom' }}
            />
            {label}
          </>
        )}
      </ZoneText>
      {children}
    </>
  );

  return (
    <Zone
      $isDragging={isDragging}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragging(false);
      }}
      onClick={() => fileInputRef.current?.click()}
      className={className}
    >
      <HiddenInput
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleFileInput}
        onClick={(e) => e.stopPropagation()}
      />
      {loadingContent === undefined ? (
        idle
      ) : (
        <Stack>
          <Layer $hidden={loading} aria-hidden={loading || undefined}>
            {idle}
          </Layer>
          <Layer $hidden aria-hidden="true">
            {loadingContent}
          </Layer>
          <Layer role="status">{loading ? loadingContent : null}</Layer>
        </Stack>
      )}
    </Zone>
  );
}
