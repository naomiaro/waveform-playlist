import { describe, it, expect, vi } from 'vitest';
import { TrackReorderHandler, type TrackReorderHost } from '../interactions/track-reorder-handler';

function makeRow(trackId: string, top: number, height: number): HTMLElement {
  const el = document.createElement('daw-track-controls');
  (el as HTMLElement & { trackId: string }).trackId = trackId;
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top,
    height,
    bottom: top + height,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
  return el;
}

function makeHost(rows: HTMLElement[]): TrackReorderHost {
  const column = document.createElement('div');
  column.className = 'controls-column';
  rows.forEach((r) => column.appendChild(r));
  const shadow = document.createElement('div');
  shadow.appendChild(column);
  return {
    isConnected: true,
    reorderTrack: vi.fn(),
    shadowRoot: {
      querySelector: (sel: string) => (sel === '.controls-column' ? column : null),
    } as unknown as ShadowRoot,
  };
}

describe('TrackReorderHandler', () => {
  it('commits the reorder on pointerup past the next row midpoint', () => {
    const rows = [makeRow('a', 0, 80), makeRow('b', 80, 80), makeRow('c', 160, 80)];
    const host = makeHost(rows);
    const handler = new TrackReorderHandler(host);
    const grip = document.createElement('button');
    rows[0].appendChild(grip);
    handler.onGrab('a', new PointerEvent('pointerdown', { pointerId: 1, clientY: 40 }), grip);
    grip.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: 130 }));
    grip.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: 130 }));
    expect(host.reorderTrack).toHaveBeenCalledWith('a', 1);
  });

  it('pointercancel reverts without committing and clears transforms', () => {
    const rows = [makeRow('a', 0, 80), makeRow('b', 80, 80)];
    const host = makeHost(rows);
    const handler = new TrackReorderHandler(host);
    const grip = document.createElement('button');
    rows[0].appendChild(grip);
    handler.onGrab('a', new PointerEvent('pointerdown', { pointerId: 1, clientY: 40 }), grip);
    grip.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: 130 }));
    expect(rows[0].style.transform).not.toBe('');
    grip.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));
    expect(host.reorderTrack).not.toHaveBeenCalled();
    expect(rows[0].style.transform).toBe('');
    expect(rows[1].style.transform).toBe('');
  });

  it('ignores pointermove from a different pointerId (palm rejection)', () => {
    const rows = [makeRow('a', 0, 80), makeRow('b', 80, 80)];
    const host = makeHost(rows);
    const handler = new TrackReorderHandler(host);
    const grip = document.createElement('button');
    rows[0].appendChild(grip);
    handler.onGrab('a', new PointerEvent('pointerdown', { pointerId: 1, clientY: 40 }), grip);
    grip.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientY: 130 }));
    grip.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: 40 }));
    expect(host.reorderTrack).not.toHaveBeenCalled();
  });
});
