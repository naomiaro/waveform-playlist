import React from 'react';
import { createRoot } from 'react-dom/client';
import { SelectionTimeInputs } from '@waveform-playlist/ui-components';

export interface SelectionTimeInputsManagerProps {
  container: HTMLElement | string; // Where to mount the component (element or selector)
  onSelectionChange?: (start: number, end: number) => void;
}

/**
 * Manages the selection time inputs by replacing the existing HTML inputs
 * with React components
 */
export class SelectionTimeInputsManager {
  private root: ReturnType<typeof createRoot> | null = null;
  private selectionStart: number = 0;
  private selectionEnd: number = 0;
  private onSelectionChange?: (start: number, end: number) => void;

  constructor(props: SelectionTimeInputsManagerProps) {
    console.log('SelectionTimeInputsManager: constructor called');
    this.onSelectionChange = props.onSelectionChange;
    this.mount(props.container);
  }

  private mount(containerOrSelector: HTMLElement | string) {
    // Find the container with the time inputs
    const container = typeof containerOrSelector === 'string'
      ? document.querySelector(containerOrSelector)
      : containerOrSelector;

    if (!container) {
      console.warn(`SelectionTimeInputsManager: container not found`);
      return;
    }

    console.log('SelectionTimeInputsManager: container found', container);

    // Find and remove the existing audio-start and audio-end inputs
    const existingStartInput = container.querySelector('#audio_start');
    const existingEndInput = container.querySelector('#audio_end');

    if (!existingStartInput || !existingEndInput) {
      console.warn('SelectionTimeInputsManager: audio_start or audio_end input not found', {
        hasStart: !!existingStartInput,
        hasEnd: !!existingEndInput
      });
      return;
    }

    console.log('SelectionTimeInputsManager: found existing inputs, replacing with React components');

    // Create a wrapper div to mount our React component
    const wrapper = document.createElement('div');
    wrapper.style.display = 'contents'; // Don't affect layout

    // Insert wrapper before the first input
    existingStartInput.parentNode?.insertBefore(wrapper, existingStartInput);

    // Remove the old inputs
    existingStartInput.remove();
    existingEndInput.remove();

    // Mount React component
    this.root = createRoot(wrapper);
    this.render();
    console.log('SelectionTimeInputsManager: React components mounted');
  }

  private render() {
    if (!this.root) return;

    this.root.render(
      <SelectionTimeInputs
        selectionStart={this.selectionStart}
        selectionEnd={this.selectionEnd}
        onSelectionChange={(start, end) => {
          this.selectionStart = start;
          this.selectionEnd = end;
          this.onSelectionChange?.(start, end);
          this.render();
        }}
      />
    );
  }

  /**
   * Update the selection times displayed in the inputs
   */
  updateSelection(start: number, end: number) {
    console.log('SelectionTimeInputsManager: updateSelection called', { start, end });
    this.selectionStart = start;
    this.selectionEnd = end;
    this.render();
  }

  /**
   * Clean up and unmount the component
   */
  dispose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
