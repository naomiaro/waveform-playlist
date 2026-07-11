import { html } from 'lit';
import type { ReactiveController, ReactiveControllerHost, TemplateResult } from 'lit';
import type { AnnotationData } from '@waveform-playlist/core';
import type { DawAnnotationTrackElement } from '../elements/daw-annotation-track';

/**
 * Fixed lane height. A TS constant (not a CSS var) because the frozen-panes
 * controls-column spacer and the beats-grid top offset need it in layout math.
 */
export const ANNOTATION_LANE_HEIGHT = 32;

export interface AnnotationControllerHost extends ReactiveControllerHost, HTMLElement {
  effectiveSampleRate: number;
  seekTo(time: number): void;
}

/**
 * Registers <daw-annotation-track> light-DOM children and renders their
 * timeline lanes inside the editor's shadow DOM. Rendering only — drag
 * interactions live in interactions/annotation-drag.ts.
 */
export class AnnotationController implements ReactiveController {
  private _host: AnnotationControllerHost;
  private _tracks: DawAnnotationTrackElement[] = [];
  private _removalObserver: MutationObserver | null = null;

  constructor(host: AnnotationControllerHost) {
    this._host = host;
    host.addController(this);
  }

  get tracks(): readonly DawAnnotationTrackElement[] {
    return this._tracks;
  }

  get totalLaneHeight(): number {
    return this._tracks.length * ANNOTATION_LANE_HEIGHT;
  }

  /** Max annotation end (seconds) across registered tracks — 0 when none.
   * Lets the editor extend the timeline so annotations past the audio stay
   * reachable/scrollable. */
  get maxAnnotationEndSeconds(): number {
    return this._tracks.reduce(
      (max, track) => track.annotations.reduce((m, a) => Math.max(m, a.end), max),
      0
    );
  }

  hostConnected(): void {
    this._host.addEventListener('daw-annotation-update', this._onDataChange);
    this._host.addEventListener('daw-annotation-select', this._onDataChange);
    this._host.addEventListener('daw-annotation-connected', this._onDataChange);
    // Removals can't bubble — observe childList like the editor's track observer.
    this._removalObserver = new MutationObserver((mutations) => {
      let changed = false;
      for (const m of mutations) {
        for (const node of Array.from(m.removedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.tagName === 'DAW-ANNOTATION-TRACK') {
            this._tracks = this._tracks.filter((t) => t !== node);
            changed = true;
          } else if (node.tagName === 'DAW-ANNOTATION') {
            changed = true;
          }
          // A wrapper element containing a track (rather than the track
          // itself) is removed — recurse into the subtree like the editor's
          // track observer, or the nested track is never unregistered.
          const nestedTracks = node.querySelectorAll?.('daw-annotation-track');
          if (nestedTracks) {
            for (const nested of nestedTracks) {
              this._tracks = this._tracks.filter((t) => t !== nested);
              changed = true;
            }
          }
          const nestedAnnotations = node.querySelectorAll?.('daw-annotation');
          if (nestedAnnotations && nestedAnnotations.length > 0) {
            changed = true;
          }
        }
      }
      if (changed) this._host.requestUpdate();
    });
    this._removalObserver.observe(this._host, { childList: true, subtree: true });
  }

  hostDisconnected(): void {
    this._host.removeEventListener('daw-annotation-update', this._onDataChange);
    this._host.removeEventListener('daw-annotation-select', this._onDataChange);
    this._host.removeEventListener('daw-annotation-connected', this._onDataChange);
    this._removalObserver?.disconnect();
    this._removalObserver = null;
    this._tracks = [];
  }

  private _onDataChange = (): void => {
    this._host.requestUpdate();
  };

  handleTrackConnected(el: DawAnnotationTrackElement): void {
    if (this._tracks.includes(el)) return;
    this._tracks = [...this._tracks, el];
    this._host.requestUpdate();
  }

  /** Pixel geometry for one annotation box. Floor-based like clip positioning. */
  boxGeometry(a: AnnotationData, spp: number, sampleRate: number): { left: number; width: number } {
    const left = Math.floor((a.start * sampleRate) / spp);
    const width = Math.floor((a.end * sampleRate) / spp) - left;
    return { left, width };
  }

  /**
   * Lane templates for the editor's .timeline. onPointerDown is supplied by
   * the editor and dispatches into the drag interaction (Task 9).
   */
  renderLanes(
    spp: number,
    sampleRate: number,
    onPointerDown: (e: PointerEvent, track: DawAnnotationTrackElement) => void = () => {}
  ): TemplateResult[] {
    return this._tracks.map((track) => {
      const activeId = track.activeAnnotationId;
      return html`
        <div
          class="annotation-lane"
          style="height: ${ANNOTATION_LANE_HEIGHT}px;"
          @pointerdown=${(e: PointerEvent) => onPointerDown(e, track)}
        >
          ${track.annotations.map((a) => {
            const geo = this.boxGeometry(a, spp, sampleRate);
            return html`
              <div
                class="annotation-box ${a.id === activeId ? 'active' : ''}"
                data-annotation-id=${a.id}
                style="left: ${geo.left}px; width: ${geo.width}px;"
              >
                ${track.editable
                  ? html`<div class="annotation-boundary" data-edge="start"></div>`
                  : ''}
                <span class="annotation-box-text">${a.lines.join(' ')}</span>
                ${track.editable
                  ? html`<div class="annotation-boundary" data-edge="end"></div>`
                  : ''}
              </div>
            `;
          })}
        </div>
      `;
    });
  }
}
