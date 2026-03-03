import { Feedback } from '@dnd-kit/dom';
import type { Plugins } from '@dnd-kit/abstract';

/**
 * DragDropProvider plugins customizer that disables the Feedback plugin's drop animation.
 *
 * Without this, the Feedback plugin animates the dragged element back to its original
 * position on drop, causing a visual snap-back before React re-renders at the new position.
 *
 * Usage:
 * ```tsx
 * <DragDropProvider plugins={noDropAnimationPlugins} ...>
 * ```
 */
export const noDropAnimationPlugins = (defaults: Plugins): Plugins =>
  defaults.map((p) =>
    p === Feedback ? Feedback.configure({ dropAnimation: null }) : p
  );
