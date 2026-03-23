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
    updateTrack: vi.fn(),
    getClipBounds: vi.fn().mockReturnValue({
      offsetSamples: 0,
      durationSamples: 48000,
      startSample: 0,
      sourceDurationSamples: 96000,
    }),
    // Default: pass through unconstrained (tests can override)
    constrainTrimDelta: vi.fn().mockImplementation((_t, _c, _b, d) => d),
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
    reextractClipPeaks: vi.fn().mockReturnValue(null),
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

      expect(engine.moveClip).toHaveBeenCalledWith('track-1', 'clip-1', 50 * 1024, true);
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
      expect(engine.moveClip).toHaveBeenLastCalledWith('track-1', 'clip-1', 50 * 1024, true);

      // Second move: 80px total → incremental 30px from last position
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 180 }));
      expect(engine.moveClip).toHaveBeenLastCalledWith('track-1', 'clip-1', 30 * 1024, true);
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

  describe('move calls updateTrack on pointerup', () => {
    it('calls engine.updateTrack on pointerup after move drag', () => {
      const el = makeClipEl('clip-1', 'track-1');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 150 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 150 }));

      expect(engine.updateTrack).toHaveBeenCalledWith('track-1');
    });

    it('does not call engine.updateTrack when no drag occurred', () => {
      const el = makeClipEl('clip-1', 'track-1');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 100 }));

      expect(engine.updateTrack).not.toHaveBeenCalled();
    });
  });

  describe('zero-delta guard', () => {
    it('does not dispatch daw-clip-move when cumulative delta is zero', () => {
      const el = makeClipEl('clip-1', 'track-1');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 100 }));
      // Move 4px right then 4px back — over threshold but net zero
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 104 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 100 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 100 }));

      const moveEvent = host.events.find((e) => (e as CustomEvent).type === 'daw-clip-move');
      expect(moveEvent).toBeUndefined();
    });

    it('does not dispatch daw-clip-trim when cumulative delta is zero', () => {
      const el = makeBoundaryEl('clip-1', 'track-1', 'right');
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 200 }));
      // Move 4px right then 4px back — over threshold but net zero
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 204 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 200 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 200 }));

      const trimEvent = host.events.find((e) => (e as CustomEvent).type === 'daw-clip-trim');
      expect(trimEvent).toBeUndefined();
    });
  });

  describe('trim visual feedback', () => {
    function makeClipContainer(clipId: string): HTMLElement {
      const container = document.createElement('div');
      container.classList.add('clip-container');
      container.dataset.clipId = clipId;
      container.style.left = '200px';
      container.style.width = '400px';
      // Add a waveform child
      const waveform = document.createElement('daw-waveform');
      waveform.style.left = '0px';
      container.appendChild(waveform);
      return container;
    }

    it('updates container left and width during left trim drag', () => {
      const shadowHost = document.createElement('div');
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const container = makeClipContainer('clip-1');
      shadow.appendChild(container);

      const localHost = createMockHost(engine, { shadowRoot: shadow });
      const localHandler = new ClipPointerHandler(localHost);

      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      localHandler.tryHandle(el, pointerEvent('pointerdown', { clientX: 200 }));
      // Drag 20px right
      localHandler.onPointerMove(pointerEvent('pointermove', { clientX: 220 }));

      expect(container.style.left).toBe('220px');
      expect(container.style.width).toBe('380px');
    });

    it('keeps waveform at left:0 when peaks are re-extracted during left trim', () => {
      const shadowHost = document.createElement('div');
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const container = makeClipContainer('clip-1');
      shadow.appendChild(container);

      const mockPeaks = { data: [new Int16Array(10)], length: 10 };
      const localHost = createMockHost(engine, {
        shadowRoot: shadow,
        reextractClipPeaks: vi.fn().mockReturnValue(mockPeaks),
      });
      const localHandler = new ClipPointerHandler(localHost);

      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      localHandler.tryHandle(el, pointerEvent('pointerdown', { clientX: 200 }));
      localHandler.onPointerMove(pointerEvent('pointermove', { clientX: 220 }));

      // With re-extracted peaks, waveform stays at left:0 (peaks cover full bounds)
      const waveform = container.querySelector('daw-waveform') as HTMLElement;
      expect(waveform.style.left).toBe('0px');
    });

    it('falls back to shifting waveform when peaks not available during left trim', () => {
      const shadowHost = document.createElement('div');
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const container = makeClipContainer('clip-1');
      shadow.appendChild(container);

      const localHost = createMockHost(engine, {
        shadowRoot: shadow,
        reextractClipPeaks: vi.fn().mockReturnValue(null),
      });
      const localHandler = new ClipPointerHandler(localHost);

      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      localHandler.tryHandle(el, pointerEvent('pointerdown', { clientX: 200 }));
      localHandler.onPointerMove(pointerEvent('pointermove', { clientX: 220 }));

      // Without peaks, waveform shifts left for visual stability
      const waveform = container.querySelector('daw-waveform') as HTMLElement;
      expect(waveform.style.left).toBe('-20px');
    });

    it('calls reextractClipPeaks with correct offset/duration during right trim', () => {
      const shadowHost = document.createElement('div');
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const container = makeClipContainer('clip-1');
      shadow.appendChild(container);

      const reextractClipPeaks = vi.fn().mockReturnValue(null);
      const localHost = createMockHost(engine, { shadowRoot: shadow, reextractClipPeaks });
      const localHandler = new ClipPointerHandler(localHost);

      const el = makeBoundaryEl('clip-1', 'track-1', 'right');
      localHandler.tryHandle(el, pointerEvent('pointerdown', { clientX: 600 }));
      // Drag 30px right (extend) — 30 * 1024 spp = 30720 samples
      localHandler.onPointerMove(pointerEvent('pointermove', { clientX: 630 }));

      // Original offset=0, duration=48000 (from mock engine), delta=+30720
      // Right trim: offset unchanged, duration = 48000 + 30720 = 78720
      expect(reextractClipPeaks).toHaveBeenCalledWith('clip-1', 0, 78720);
    });

    it('calls reextractClipPeaks with correct offset/duration during left trim', () => {
      const shadowHost = document.createElement('div');
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const container = makeClipContainer('clip-1');
      shadow.appendChild(container);

      const reextractClipPeaks = vi.fn().mockReturnValue(null);
      const localHost = createMockHost(engine, { shadowRoot: shadow, reextractClipPeaks });
      const localHandler = new ClipPointerHandler(localHost);

      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      localHandler.tryHandle(el, pointerEvent('pointerdown', { clientX: 200 }));
      // Drag 20px right (shrink from left) — 20 * 1024 spp = 20480 samples
      localHandler.onPointerMove(pointerEvent('pointermove', { clientX: 220 }));

      // Original offset=0, duration=48000, delta=+20480
      // Left trim: offset = 0 + 20480 = 20480, duration = 48000 - 20480 = 27520
      expect(reextractClipPeaks).toHaveBeenCalledWith('clip-1', 20480, 27520);
    });

    it('sets peaks and length on waveform elements during trim', () => {
      const shadowHost = document.createElement('div');
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const container = makeClipContainer('clip-1');
      shadow.appendChild(container);

      const mockPeaksData = new Int16Array([1, 2, 3, 4, 5]);
      const mockPeaks = { data: [mockPeaksData], length: 42 };
      const localHost = createMockHost(engine, {
        shadowRoot: shadow,
        reextractClipPeaks: vi.fn().mockReturnValue(mockPeaks),
      });
      const localHandler = new ClipPointerHandler(localHost);

      const el = makeBoundaryEl('clip-1', 'track-1', 'right');
      localHandler.tryHandle(el, pointerEvent('pointerdown', { clientX: 600 }));
      localHandler.onPointerMove(pointerEvent('pointermove', { clientX: 630 }));

      const waveform = container.querySelector('daw-waveform') as HTMLElement & {
        peaks: unknown;
        length: number;
      };
      expect(waveform.peaks).toBe(mockPeaksData);
      expect(waveform.length).toBe(42);
    });

    it('uses constrainTrimDelta to clamp visual feedback during left trim', () => {
      // Engine constrains delta to -200*1024 (timeline boundary)
      const constrainedEngine = {
        ...createMockEngine(),
        constrainTrimDelta: vi.fn().mockReturnValue(-200 * 1024),
      };
      const shadowHost = document.createElement('div');
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const container = makeClipContainer('clip-1');
      // Container starts at left:200px
      shadow.appendChild(container);

      const localHost = createMockHost(constrainedEngine, { shadowRoot: shadow });
      const localHandler = new ClipPointerHandler(localHost);

      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      localHandler.tryHandle(el, pointerEvent('pointerdown', { clientX: 200 }));
      // Drag 300px LEFT — raw delta = -300*1024, but engine constrains to -200*1024
      localHandler.onPointerMove(pointerEvent('pointermove', { clientX: -100 }));

      // Container should use constrained delta: left:0, width:600
      expect(container.style.left).toBe('0px');
      expect(container.style.width).toBe('600px');
    });

    it('uses constrainTrimDelta to prevent overlap with neighbor clips', () => {
      // Engine constrains right trim delta to 5000 samples (neighbor collision)
      const constrainedEngine = {
        ...createMockEngine(),
        constrainTrimDelta: vi.fn().mockReturnValue(5000),
      };
      const shadowHost = document.createElement('div');
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const container = makeClipContainer('clip-1');
      shadow.appendChild(container);

      const localHost = createMockHost(constrainedEngine, { shadowRoot: shadow });
      const localHandler = new ClipPointerHandler(localHost);

      const el = makeBoundaryEl('clip-1', 'track-1', 'right');
      localHandler.tryHandle(el, pointerEvent('pointerdown', { clientX: 600 }));
      // Drag 50px RIGHT — raw delta = 50*1024 = 51200, but engine constrains to 5000
      localHandler.onPointerMove(pointerEvent('pointermove', { clientX: 650 }));

      // Width should use constrained delta: 400 + round(5000/1024) = 400 + 5 = 405px
      const constrainedPx = Math.round(5000 / 1024);
      expect(container.style.width).toBe(400 + constrainedPx + 'px');
    });

    it('passes constrained delta to engine on pointerup', () => {
      // Engine constrains to -10000
      const constrainedEngine = {
        ...createMockEngine(),
        constrainTrimDelta: vi.fn().mockReturnValue(-10000),
      };
      const shadowHost = document.createElement('div');
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const container = makeClipContainer('clip-1');
      shadow.appendChild(container);

      const localHost = createMockHost(constrainedEngine, { shadowRoot: shadow });
      const localHandler = new ClipPointerHandler(localHost);

      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      localHandler.tryHandle(el, pointerEvent('pointerdown', { clientX: 200 }));
      localHandler.onPointerMove(pointerEvent('pointermove', { clientX: 100 }));
      localHandler.onPointerUp(pointerEvent('pointerup', { clientX: 100 }));

      // Engine.trimClip should receive the constrained delta
      expect(constrainedEngine.trimClip).toHaveBeenCalledWith('track-1', 'clip-1', 'left', -10000);
    });

    it('updates container width during right trim drag', () => {
      const shadowHost = document.createElement('div');
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const container = makeClipContainer('clip-1');
      shadow.appendChild(container);

      const localHost = createMockHost(engine, { shadowRoot: shadow });
      const localHandler = new ClipPointerHandler(localHost);

      const el = makeBoundaryEl('clip-1', 'track-1', 'right');
      localHandler.tryHandle(el, pointerEvent('pointerdown', { clientX: 600 }));
      // Drag 30px right (extend)
      localHandler.onPointerMove(pointerEvent('pointermove', { clientX: 630 }));

      expect(container.style.left).toBe('200px'); // unchanged
      expect(container.style.width).toBe('430px');
    });

    it('restores original CSS on pointerup', () => {
      const shadowHost = document.createElement('div');
      const shadow = shadowHost.attachShadow({ mode: 'open' });
      const container = makeClipContainer('clip-1');
      shadow.appendChild(container);

      const localHost = createMockHost(engine, { shadowRoot: shadow });
      const localHandler = new ClipPointerHandler(localHost);

      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      localHandler.tryHandle(el, pointerEvent('pointerdown', { clientX: 200 }));
      localHandler.onPointerMove(pointerEvent('pointermove', { clientX: 220 }));

      // During drag: modified
      expect(container.style.left).toBe('220px');

      localHandler.onPointerUp(pointerEvent('pointerup', { clientX: 220 }));

      // After drop: restored (engine will re-render with correct values)
      expect(container.style.left).toBe('200px');
      expect(container.style.width).toBe('400px');
      const waveform = container.querySelector('daw-waveform') as HTMLElement;
      expect(waveform.style.left).toBe('0px');
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
