import React from 'react';
import { createRoot } from 'react-dom/client';
import { MasterVolumeControl } from '@waveform-playlist/ui-components';

export interface MasterVolumeManagerProps {
  container: HTMLElement | string; // Where to mount the component (element or selector)
  volume: number; // Current volume 0-100
  onVolumeChange: (volume: number) => void;
}

/**
 * Manages the master volume control by replacing the existing HTML slider
 * with a React component
 */
export class MasterVolumeManager {
  private root: ReturnType<typeof createRoot> | null = null;
  private volume: number;
  private onVolumeChange: (volume: number) => void;

  constructor(props: MasterVolumeManagerProps) {
    console.log('MasterVolumeManager: constructor called');
    this.volume = props.volume;
    this.onVolumeChange = props.onVolumeChange;
    this.mount(props.container);
  }

  private mount(containerOrSelector: HTMLElement | string) {
    // Find the container
    const container = typeof containerOrSelector === 'string'
      ? document.querySelector(containerOrSelector)
      : containerOrSelector;

    if (!container) {
      console.warn(`MasterVolumeManager: container not found`);
      return;
    }

    console.log('MasterVolumeManager: container found', container);

    // Find and remove the existing master-gain input
    const existingInput = container.querySelector('#master-gain');
    const existingLabel = container.querySelector('label[for="master-gain"]');

    if (!existingInput) {
      console.warn('MasterVolumeManager: master-gain input not found');
      return;
    }

    console.log('MasterVolumeManager: found existing input, replacing with React component');

    // Create a wrapper div to mount our React component
    const wrapper = document.createElement('div');
    wrapper.style.display = 'contents'; // Don't affect layout

    // Insert wrapper before the label (if exists) or input
    const insertBefore = existingLabel || existingInput;
    insertBefore.parentNode?.insertBefore(wrapper, insertBefore);

    // Remove the old elements
    existingLabel?.remove();
    existingInput.remove();

    // Mount React component
    this.root = createRoot(wrapper);
    this.render();
    console.log('MasterVolumeManager: React component mounted');
  }

  private render() {
    if (!this.root) return;

    this.root.render(
      <MasterVolumeControl
        volume={this.volume}
        onChange={this.onVolumeChange}
      />
    );
  }

  /**
   * Update the volume value and re-render
   */
  updateVolume(volume: number) {
    this.volume = volume;
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
