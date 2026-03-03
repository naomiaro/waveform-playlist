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
export const noDropAnimationPlugins = (defaults: Plugins): Plugins => {
  let feedbackFound = false;
  const result = defaults.map((p) => {
    if (p === Feedback) {
      feedbackFound = true;
      return Feedback.configure({ dropAnimation: null });
    }
    return p;
  });
  if (!feedbackFound) {
    console.warn(
      '[waveform-playlist] noDropAnimationPlugins: Feedback plugin not found in defaults — ' +
        'drop animation may not be disabled. Check @dnd-kit/dom version.'
    );
  }
  return result;
};
