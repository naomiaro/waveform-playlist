import React from 'react';
import { useSortable } from '@dnd-kit/react/sortable';
import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';

export interface SortableTrackControlsRenderProps {
  /** Attach to the slot wrapper element (the sortable item). */
  ref: (element: Element | null) => void;
  /** Attach to the drag grip element. */
  handleRef: (element: Element | null) => void;
  isDragSource: boolean;
}

export interface SortableTrackControlsProps {
  trackId: string;
  index: number;
  disabled?: boolean;
  children: (props: SortableTrackControlsRenderProps) => React.ReactNode;
}

/**
 * Registers a track-controls row as a vertical sortable item in the ambient
 * DragDropProvider (ClipInteractionProvider). The per-source modifiers
 * REPLACE the provider's clip modifiers for this operation, so track drags
 * are vertical-only and skip clip collision/snap. Data kind 'track-reorder'
 * is the discriminator the shared drag handlers branch on.
 */
export const SortableTrackControls: React.FC<SortableTrackControlsProps> = ({
  trackId,
  index,
  disabled = false,
  children,
}) => {
  const { ref, handleRef, isDragSource } = useSortable({
    id: `track-reorder-${trackId}`,
    index,
    group: 'playlist-tracks',
    type: 'track',
    accept: ['track'],
    data: { kind: 'track-reorder', trackId },
    modifiers: [RestrictToVerticalAxis],
    disabled,
  });
  return <>{children({ ref, handleRef, isDragSource })}</>;
};
