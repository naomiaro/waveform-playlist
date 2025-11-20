import { useEffect } from 'react';

export interface UseAudioPositionProps {
  currentTime: number;
  formatTime: (seconds: number) => string;
  selector?: string; // CSS selector for the element to update (default: '.audio-pos')
}

/**
 * Hook to update the audio position display element
 * This maintains backward compatibility with existing HTML structure
 * but could be replaced with a render prop pattern
 */
export function useAudioPosition({
  currentTime,
  formatTime,
  selector = '.audio-pos',
}: UseAudioPositionProps): void {
  useEffect(() => {
    const audioPosElement = document.querySelector(selector);
    if (audioPosElement) {
      audioPosElement.textContent = formatTime(currentTime);
    }
  }, [currentTime, formatTime, selector]);
}
