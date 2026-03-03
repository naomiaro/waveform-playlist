/**
 * Hook for configuring @dnd-kit sensors for clip dragging
 *
 * Provides consistent drag activation behavior across all examples.
 * The @dnd-kit/dom PointerSensor has built-in defaults:
 * - Mouse on handle element: immediate activation (no constraints)
 * - Touch: 250ms delay with 5px tolerance
 * - Text inputs: 200ms delay with 0 tolerance
 * - Other: 200ms delay/10px tolerance + 5px distance (whichever fires first)
 */

import { useMemo } from 'react';
import { PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom';
import type { PluginDescriptor } from '@dnd-kit/abstract';

export interface DragSensorOptions {
  /**
   * Enable mobile-optimized touch handling with delay-based activation.
   * When true, uses PointerSensor with custom touch delay.
   * When false (default), uses PointerSensor defaults (already touch-aware).
   */
  touchOptimized?: boolean;
  /**
   * Delay in milliseconds before touch drag activates (only when touchOptimized is true).
   * Default: 250ms - long enough to distinguish from scroll intent
   */
  touchDelay?: number;
  /**
   * Distance tolerance during touch delay (only when touchOptimized is true).
   * If finger moves more than this during delay, drag is cancelled.
   * Default: 5px - allows slight finger movement
   */
  touchTolerance?: number;
  /**
   * Distance in pixels before mouse drag activates.
   * Default: 1px for immediate feedback on desktop
   */
  mouseDistance?: number;
}

/**
 * Returns configured sensors for @dnd-kit drag operations
 *
 * @param options - Configuration options for drag sensors
 * @returns Array of sensor constructors/descriptors for DragDropProvider's sensors prop
 *
 * @example
 * // Desktop-optimized (default — uses PointerSensor defaults)
 * const sensors = useDragSensors();
 *
 * @example
 * // Mobile-optimized with custom touch delay
 * const sensors = useDragSensors({ touchOptimized: true, touchDelay: 300 });
 */
export function useDragSensors(
  options: DragSensorOptions = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (typeof PointerSensor | PluginDescriptor<any, any, any>)[] {
  const {
    touchOptimized = false,
    touchDelay = 250,
    touchTolerance = 5,
    mouseDistance = 1,
  } = options;

  return useMemo(() => {
    if (touchOptimized) {
      // Custom activation constraints for touch-optimized mode
      return [
        PointerSensor.configure({
          activationConstraints(event) {
            // Touch events get delay-based activation
            if (event.pointerType === 'touch') {
              return [
                new PointerActivationConstraints.Delay({
                  value: touchDelay,
                  tolerance: touchTolerance,
                }),
              ];
            }
            // Mouse/pen get distance-based activation
            return [new PointerActivationConstraints.Distance({ value: mouseDistance })];
          },
        }),
      ];
    }

    // Default: PointerSensor with distance-based activation
    return [
      PointerSensor.configure({
        activationConstraints: [
          new PointerActivationConstraints.Distance({ value: mouseDistance }),
        ],
      }),
    ];
  }, [touchOptimized, touchDelay, touchTolerance, mouseDistance]);
}
