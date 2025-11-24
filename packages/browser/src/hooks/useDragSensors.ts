/**
 * Hook for configuring @dnd-kit sensors for clip dragging
 *
 * Provides consistent drag activation behavior across all examples
 */

import { useSensor, useSensors, PointerSensor } from '@dnd-kit/core';

/**
 * Returns configured sensors for @dnd-kit drag operations
 *
 * @returns Configured sensors with 1px activation distance for immediate feedback
 */
export function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1, // Require 1px movement before drag starts (immediate feedback)
      },
    })
  );
}
