import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClipPointerHandler } from '../interactions/clip-pointer-handler';
import type { ClipEngineContract, ClipPointerHost } from '../interactions/clip-pointer-handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockEngine(): ClipEngineContract {
  return {
    moveClip: vi.fn(),
    trimClip: vi.fn(),
  };
}

function createMockHost(
  engine: ClipEngineContract | null,
  overrides: Partial<ClipPointerHost> = {}
): ClipPointerHost & { events: Event[] } {
  const events: Event[] = [];

  const shadowHost = document.createElement('div');
  const shadow = shadowHost.attachShadow({ mode: 'open' });

  return {
    samplesPerPixel: 1024,
    effectiveSampleRate: 48000,
    interactiveClips: true,
    engine,
    shadowRoot: shadow,
    dispatchEvent: vi.fn((event: Event) => {
      events.push(event);
      return true;
    }),
    requestUpdate: vi.fn(),
    events,
    ...overrides,
  };
}

function makeClipEl(clipId: string, trackId: string): HTMLElement {
  const el = document.createElement('div');
  el.classList.add('clip-header');
  el.dataset.clipId = clipId;
  el.dataset.trackId = trackId;
  el.dataset.interactive = '';
  return el;
}

function makeBoundaryEl(clipId: string, trackId: string, edge: 'left' | 'right'): HTMLElement {
  const el = document.createElement('div');
  el.classList.add('clip-boundary');
  el.dataset.boundaryEdge = edge;
  el.dataset.clipId = clipId;
  el.dataset.trackId = trackId;
  return el;
}

function pointerEvent(
  type: string,
  opts: { clientX?: number; pointerId?: number } = {}
): PointerEvent {
  return new PointerEvent(type, {
    clientX: opts.clientX ?? 0,
    pointerId: opts.pointerId ?? 1,
    bubbles: true,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClipPointerHandler', () => {
  let engine: ClipEngineContract;
  let host: ReturnType<typeof createMockHost>;
  let handler: ClipPointerHandler;

  beforeEach(() => {
    engine = createMockEngine();
    host = createMockHost(engine);
    handler = new ClipPointerHandler(host);
  });

  describe('tryHandle — target detection', () => {
    it('returns false when interactiveClips is disabled', () => {
      const disabledHost = createMockHost(engine, { interactiveClips: false });
      const disabledHandler = new ClipPointerHandler(disabledHost);
      const el = makeClipEl('clip-1', 'track-1');
      const e = pointerEvent('pointerdown', { clientX: 100 });

      expect(disabledHandler.tryHandle(el, e)).toBe(false);
    });

    it('returns true for clip header element with data-interactive', () => {
      const el = makeClipEl('clip-1', 'track-1');
      const e = pointerEvent('pointerdown', { clientX: 100 });

      expect(handler.tryHandle(el, e)).toBe(true);
    });

    it('returns true for boundary element with data-boundary-edge', () => {
      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      const e = pointerEvent('pointerdown', { clientX: 100 });

      expect(handler.tryHandle(el, e)).toBe(true);
    });

    it('returns false for non-clip elements', () => {
      const el = document.createElement('div');
      el.classList.add('timeline');
      const e = pointerEvent('pointerdown', { clientX: 100 });

      expect(handler.tryHandle(el, e)).toBe(false);
    });

    it('returns false for clip-header without data-interactive', () => {
      const el = document.createElement('div');
      el.classList.add('clip-header');
      el.dataset.clipId = 'clip-1';
      el.dataset.trackId = 'track-1';
      // No data-interactive attribute
      const e = pointerEvent('pointerdown', { clientX: 100 });

      expect(handler.tryHandle(el, e)).toBe(false);
    });

    it('returns true when target is a child of clip-header (e.g. span)', () => {
      const header = makeClipEl('clip-1', 'track-1');
      const span = document.createElement('span');
      span.textContent = 'vocals.wav';
      header.appendChild(span);
      // Append to DOM so closest() can walk the tree
      document.body.appendChild(header);

      const e = pointerEvent('pointerdown', { clientX: 100 });
      expect(handler.tryHandle(span, e)).toBe(true);

      document.body.removeChild(header);
    });

    it('returns true when target is a child of clip-boundary', () => {
      const boundary = makeBoundaryEl('clip-1', 'track-1', 'right');
      const inner = document.createElement('div');
      boundary.appendChild(inner);
      document.body.appendChild(boundary);

      const e = pointerEvent('pointerdown', { clientX: 100 });
      expect(handler.tryHandle(inner, e)).toBe(true);

      document.body.removeChild(boundary);
    });
  });

  describe('isActive', () => {
    it('returns false before any interaction', () => {
      expect(handler.isActive).toBe(false);
    });

    it('returns true after tryHandle succeeds', () => {
      const el = makeClipEl('clip-1', 'track-1');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));

      expect(handler.isActive).toBe(true);
    });
  });

  describe('move drag', () => {
    it('calls engine.moveClip with correct sample delta (px * samplesPerPixel)', () => {
      const el = makeClipEl('clip-1', 'track-1');
      // Start at px=100
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));

      // Move 50px — over threshold
      // samplesPerPixel=1024, so deltaSamples = 50 * 1024 = 51200
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 150 }));

      expect(engine.moveClip).toHaveBeenCalledWith('track-1', 'clip-1', 50 * 1024);
    });

    it('does not call engine when movement is within threshold (<=3px)', () => {
      const el = makeClipEl('clip-1', 'track-1');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));

      // Move only 3px — at threshold (not over)
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 103 }));

      expect(engine.moveClip).not.toHaveBeenCalled();
    });

    it('does not call engine when movement is under threshold (<3px)', () => {
      const el = makeClipEl('clip-1', 'track-1');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));

      // Move only 2px
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 102 }));

      expect(engine.moveClip).not.toHaveBeenCalled();
    });

    it('dispatches daw-clip-move event on pointerup after drag', () => {
      const el = makeClipEl('clip-1', 'track-1');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 150 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 150 }));

      const moveEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-clip-move'
      ) as CustomEvent;
      expect(moveEvent).toBeDefined();
      expect(moveEvent.detail.trackId).toBe('track-1');
      expect(moveEvent.detail.clipId).toBe('clip-1');
      expect(moveEvent.detail.deltaSamples).toBe(50 * 1024);
    });

    it('uses incremental delta for engine calls during drag', () => {
      const el = makeClipEl('clip-1', 'track-1');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));

      // First move: 50px total → incremental 50px
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 150 }));
      expect(engine.moveClip).toHaveBeenLastCalledWith('track-1', 'clip-1', 50 * 1024);

      // Second move: 80px total → incremental 30px from last position
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 180 }));
      expect(engine.moveClip).toHaveBeenLastCalledWith('track-1', 'clip-1', 30 * 1024);
    });

    it('dispatches daw-clip-move with cumulative deltaSamples', () => {
      const el = makeClipEl('clip-1', 'track-1');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));

      // Two moves: 50px + 30px = 80px total
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 150 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 180 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 180 }));

      const moveEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-clip-move'
      ) as CustomEvent;
      expect(moveEvent).toBeDefined();
      expect(moveEvent.detail.deltaSamples).toBe(80 * 1024);
    });

    it('does not dispatch daw-clip-move when no drag occurred', () => {
      const el = makeClipEl('clip-1', 'track-1');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));
      // Up without any movement
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 100 }));

      const moveEvent = host.events.find((e) => (e as CustomEvent).type === 'daw-clip-move');
      expect(moveEvent).toBeUndefined();
    });

    it('resets isActive after pointerup', () => {
      const el = makeClipEl('clip-1', 'track-1');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 150 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 150 }));

      expect(handler.isActive).toBe(false);
    });
  });

  describe('trim left', () => {
    it('does not call engine.trimClip during drag (only on pointerup)', () => {
      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));

      // Move 20px right — over threshold
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 120 }));

      // Engine should NOT be called during drag — trim uses cumulative delta at end
      expect(engine.trimClip).not.toHaveBeenCalled();
    });

    it('calls engine.trimClip with cumulative delta on pointerup', () => {
      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 120 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 120 }));

      expect(engine.trimClip).toHaveBeenCalledWith('track-1', 'clip-1', 'left', 20 * 1024);
    });

    it('dispatches daw-clip-trim event with boundary=left on pointerup', () => {
      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 120 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 120 }));

      const trimEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-clip-trim'
      ) as CustomEvent;
      expect(trimEvent).toBeDefined();
      expect(trimEvent.detail.trackId).toBe('track-1');
      expect(trimEvent.detail.clipId).toBe('clip-1');
      expect(trimEvent.detail.boundary).toBe('left');
      expect(trimEvent.detail.deltaSamples).toBe(20 * 1024);
    });
  });

  describe('trim right', () => {
    it('does not call engine.trimClip during drag', () => {
      const el = makeBoundaryEl('clip-1', 'track-1', 'right');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 200 }));

      // Move 30px left — over threshold
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 170 }));

      expect(engine.trimClip).not.toHaveBeenCalled();
    });

    it('calls engine.trimClip with cumulative delta on pointerup', () => {
      const el = makeBoundaryEl('clip-1', 'track-1', 'right');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 200 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 170 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 170 }));

      expect(engine.trimClip).toHaveBeenCalledWith('track-1', 'clip-1', 'right', -30 * 1024);
    });

    it('dispatches daw-clip-trim event with boundary=right on pointerup', () => {
      const el = makeBoundaryEl('clip-1', 'track-1', 'right');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 200 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 170 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 170 }));

      const trimEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-clip-trim'
      ) as CustomEvent;
      expect(trimEvent).toBeDefined();
      expect(trimEvent.detail.boundary).toBe('right');
      expect(trimEvent.detail.deltaSamples).toBe(-30 * 1024);
    });
  });

  describe('event properties', () => {
    it('daw-clip-move event has bubbles=true and composed=true', () => {
      const el = makeClipEl('clip-1', 'track-1');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 150 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 150 }));

      const moveEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-clip-move'
      ) as CustomEvent;
      expect(moveEvent.bubbles).toBe(true);
      expect(moveEvent.composed).toBe(true);
    });

    it('daw-clip-trim event has bubbles=true and composed=true', () => {
      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 120 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 120 }));

      const trimEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-clip-trim'
      ) as CustomEvent;
      expect(trimEvent.bubbles).toBe(true);
      expect(trimEvent.composed).toBe(true);
    });
  });
});
