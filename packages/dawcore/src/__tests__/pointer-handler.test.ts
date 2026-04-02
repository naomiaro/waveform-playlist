import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PointerHandler } from '../interactions/pointer-handler';
import type { PointerHandlerHost, PointerEngineContract } from '../interactions/pointer-handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockEngine(): PointerEngineContract {
  return {
    setSelection: vi.fn(),
    stop: vi.fn(),
    play: vi.fn(),
    seek: vi.fn(),
    selectTrack: vi.fn(),
  };
}

function createMockTimeline(): HTMLElement {
  const trackRow = document.createElement('div');
  trackRow.classList.add('track-row');
  trackRow.dataset.trackId = 'track-1';
  // Position the track row at y=[0, 128)
  vi.spyOn(trackRow, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 128,
    left: 0,
    right: 500,
    width: 500,
    height: 128,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  const timeline = document.createElement('div');
  timeline.classList.add('timeline');
  timeline.appendChild(trackRow);
  vi.spyOn(timeline, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 128,
    left: 0,
    right: 500,
    width: 500,
    height: 128,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  timeline.setPointerCapture = vi.fn();
  timeline.releasePointerCapture = vi.fn();

  return timeline;
}

function createMockHost(
  overrides: Partial<PointerHandlerHost> = {}
): PointerHandlerHost & { events: Event[]; _selectedTrackId: string | null } {
  const events: Event[] = [];

  // Create a minimal Shadow DOM with a timeline
  const shadowHost = document.createElement('div');
  const shadow = shadowHost.attachShadow({ mode: 'open' });
  const timeline = createMockTimeline();
  shadow.appendChild(timeline);

  const host = {
    samplesPerPixel: 1024,
    _engine: null as PointerHandlerHost['_engine'],
    _isPlaying: false,
    effectiveSampleRate: 48000,
    _currentTime: 0,
    _selectionStartTime: 0,
    _selectionEndTime: 0,
    _dragOver: false,
    _selectedTrackId: null as string | null,
    _setSelectedTrackId: vi.fn(),
    _startPlayhead: vi.fn(),
    _stopPlayhead: vi.fn(),
    dispatchEvent: vi.fn((event: Event) => {
      events.push(event);
      return true;
    }),
    shadowRoot: shadow,
    requestUpdate: vi.fn(),
    _clipHandler: null,
    scaleMode: 'temporal' as const,
    ticksPerPixel: 4,
    bpm: 120,
    ppqn: 960,
    _meterEntries: [{ tick: 0, numerator: 4, denominator: 4 }],
    snapTo: 'off' as const,
    _secondsToTicks: (s: number) => (s * 120 * 960) / 60,
    _ticksToSeconds: (t: number) => (t * 60) / (120 * 960),
    events,
    ...overrides,
  };
  // Wire _setSelectedTrackId to update the _selectedTrackId field for test assertions
  host._setSelectedTrackId = vi.fn((id: string | null) => {
    host._selectedTrackId = id;
  });
  return host;
}

function pointerEvent(
  type: string,
  opts: { clientX?: number; clientY?: number; pointerId?: number } = {}
): PointerEvent {
  return new PointerEvent(type, {
    clientX: opts.clientX ?? 100,
    clientY: opts.clientY ?? 64,
    pointerId: opts.pointerId ?? 1,
    bubbles: true,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PointerHandler', () => {
  let host: ReturnType<typeof createMockHost>;
  let handler: PointerHandler;

  beforeEach(() => {
    host = createMockHost();
    handler = new PointerHandler(host);
  });

  describe('click-to-seek', () => {
    it('dispatches daw-seek with correct time on click (no drag)', () => {
      const down = pointerEvent('pointerdown', { clientX: 100 });
      handler.onPointerDown(down);

      // Immediate up at same position = click
      const up = pointerEvent('pointerup', { clientX: 100 });
      // Simulate the pointerup event on the timeline
      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      timeline.dispatchEvent(up);

      const seekEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-seek'
      ) as CustomEvent;
      expect(seekEvent).toBeDefined();
      // pixel 100, spp=1024, sr=48000 → (100 * 1024) / 48000 ≈ 2.1333
      expect(seekEvent.detail.time).toBeCloseTo(2.1333, 3);
    });

    it('clears selection on click', () => {
      host._selectionStartTime = 1;
      host._selectionEndTime = 5;

      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 50 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 50 }));

      expect(host._selectionStartTime).toBe(0);
      expect(host._selectionEndTime).toBe(0);
    });

    it('calls engine.seek when not playing', () => {
      const engine = createMockEngine();
      host = createMockHost({ _engine: engine, _isPlaying: false });
      handler = new PointerHandler(host);

      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 200 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 200 }));

      expect(engine.seek).toHaveBeenCalledOnce();
      expect(engine.stop).not.toHaveBeenCalled();
    });

    it('calls engine.stop then play when playing', () => {
      const engine = createMockEngine();
      host = createMockHost({ _engine: engine, _isPlaying: true });
      handler = new PointerHandler(host);

      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 200 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 200 }));

      expect(engine.stop).toHaveBeenCalledOnce();
      expect(engine.play).toHaveBeenCalledOnce();
      expect(host._startPlayhead).toHaveBeenCalledOnce();
    });
  });

  describe('drag-to-select', () => {
    it('does not start drag under 3px threshold', () => {
      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 100 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;

      // Move only 2px — under threshold
      timeline.dispatchEvent(pointerEvent('pointermove', { clientX: 102 }));
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 102 }));

      // Should dispatch seek, not selection
      const seekEvent = host.events.find((e) => (e as CustomEvent).type === 'daw-seek');
      expect(seekEvent).toBeDefined();
      const selEvent = host.events.find((e) => (e as CustomEvent).type === 'daw-selection');
      expect(selEvent).toBeUndefined();
    });

    it('starts drag after 3px threshold and dispatches daw-selection', () => {
      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 100 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;

      // Move 50px — well over threshold
      timeline.dispatchEvent(pointerEvent('pointermove', { clientX: 150 }));
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 150 }));

      const selEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-selection'
      ) as CustomEvent;
      expect(selEvent).toBeDefined();
      expect(selEvent.detail.start).toBeLessThan(selEvent.detail.end);
    });

    it('normalizes right-to-left drag (start < end)', () => {
      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 200 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;

      // Drag left
      timeline.dispatchEvent(pointerEvent('pointermove', { clientX: 100 }));
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 100 }));

      // Selection times should be normalized
      expect(host._selectionStartTime).toBeLessThanOrEqual(host._selectionEndTime);

      const selEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-selection'
      ) as CustomEvent;
      expect(selEvent!.detail.start).toBeLessThanOrEqual(selEvent!.detail.end);
    });

    it('calls engine.setSelection on finalize', () => {
      const engine = createMockEngine();
      host = createMockHost({ _engine: engine });
      handler = new PointerHandler(host);

      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 100 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      timeline.dispatchEvent(pointerEvent('pointermove', { clientX: 200 }));
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 200 }));

      expect(engine.setSelection).toHaveBeenCalledOnce();
    });
  });

  describe('track selection', () => {
    it('dispatches daw-track-select on click within track row', () => {
      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 50, clientY: 64 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 64 }));

      const trackEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-track-select'
      ) as CustomEvent;
      expect(trackEvent).toBeDefined();
      expect(trackEvent.detail.trackId).toBe('track-1');
    });

    it('sets _selectedTrackId locally when no engine', () => {
      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 50, clientY: 64 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 64 }));

      expect(host._selectedTrackId).toBe('track-1');
    });

    it('calls engine.selectTrack when engine exists', () => {
      const engine = createMockEngine();
      host = createMockHost({ _engine: engine });
      handler = new PointerHandler(host);

      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 50, clientY: 64 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 64 }));

      expect(engine.selectTrack).toHaveBeenCalledWith('track-1');
    });

    it('dispatches daw-track-select even when engine path succeeds', () => {
      const engine = createMockEngine();
      host = createMockHost({ _engine: engine });
      handler = new PointerHandler(host);

      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 50, clientY: 64 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 64 }));

      const trackEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-track-select'
      ) as CustomEvent;
      expect(trackEvent).toBeDefined();
      expect(trackEvent.detail.trackId).toBe('track-1');
    });

    it('falls through to local selection when engine.selectTrack throws', () => {
      const engine = createMockEngine();
      (engine.selectTrack as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('engine error');
      });
      host = createMockHost({ _engine: engine });
      handler = new PointerHandler(host);

      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 50, clientY: 64 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 64 }));

      // Should still set locally and dispatch event
      expect(host._selectedTrackId).toBe('track-1');
      const trackEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-track-select'
      ) as CustomEvent;
      expect(trackEvent).toBeDefined();
    });
  });

  describe('clip handler delegation', () => {
    // onPointerDown uses e.composedPath()[0] to get the click target.
    // We must dispatch the event through the DOM so composedPath works,
    // using @pointerdown on the timeline (matching daw-editor's template).

    it('delegates to clipHandler when tryHandle returns true', () => {
      const mockClipHandler = {
        tryHandle: vi.fn().mockReturnValue(true),
        onPointerMove: vi.fn(),
        onPointerUp: vi.fn(),
        isActive: true,
      };
      host = createMockHost({ _clipHandler: mockClipHandler });
      handler = new PointerHandler(host);

      // Add a clip header inside the timeline for composedPath
      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      const clipHeader = document.createElement('div');
      clipHeader.classList.add('clip-header');
      timeline.appendChild(clipHeader);

      // Dispatch through the DOM so composedPath()[0] = clipHeader
      timeline.addEventListener('pointerdown', handler.onPointerDown as EventListener);
      clipHeader.dispatchEvent(pointerEvent('pointerdown', { clientX: 150 }));

      expect(mockClipHandler.tryHandle).toHaveBeenCalled();
      // Seek should NOT have been triggered (no daw-seek event)
      const seekEvent = host.events.find((e) => (e as CustomEvent).type === 'daw-seek');
      expect(seekEvent).toBeUndefined();
    });

    it('falls through to seek when clipHandler.tryHandle returns false', () => {
      const mockClipHandler = {
        tryHandle: vi.fn().mockReturnValue(false),
        onPointerMove: vi.fn(),
        onPointerUp: vi.fn(),
        isActive: false,
      };
      host = createMockHost({ _clipHandler: mockClipHandler });
      handler = new PointerHandler(host);

      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      timeline.addEventListener('pointerdown', handler.onPointerDown as EventListener);
      timeline.dispatchEvent(pointerEvent('pointerdown', { clientX: 150 }));
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 150 }));

      expect(mockClipHandler.tryHandle).toHaveBeenCalled();
      // Should fall through to seek
      const seekEvent = host.events.find((e) => (e as CustomEvent).type === 'daw-seek');
      expect(seekEvent).toBeDefined();
    });

    it('wires pointermove and pointerup to clipHandler after delegation', () => {
      const mockClipHandler = {
        tryHandle: vi.fn().mockReturnValue(true),
        onPointerMove: vi.fn(),
        onPointerUp: vi.fn(),
        isActive: true,
      };
      host = createMockHost({ _clipHandler: mockClipHandler });
      handler = new PointerHandler(host);

      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      const clipHeader = document.createElement('div');
      clipHeader.classList.add('clip-header');
      timeline.appendChild(clipHeader);

      timeline.addEventListener('pointerdown', handler.onPointerDown as EventListener);
      clipHeader.dispatchEvent(pointerEvent('pointerdown', { clientX: 150 }));

      // Simulate pointermove and pointerup on the timeline
      timeline.dispatchEvent(pointerEvent('pointermove', { clientX: 170 }));
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 170 }));

      expect(mockClipHandler.onPointerMove).toHaveBeenCalled();
      expect(mockClipHandler.onPointerUp).toHaveBeenCalled();
    });

    it('skips delegation when _clipHandler is null', () => {
      host = createMockHost({ _clipHandler: null });
      handler = new PointerHandler(host);

      handler.onPointerDown(pointerEvent('pointerdown', { clientX: 150 }));
      const timeline = host.shadowRoot!.querySelector('.timeline')!;
      timeline.dispatchEvent(pointerEvent('pointerup', { clientX: 150 }));

      // Normal seek should work
      const seekEvent = host.events.find((e) => (e as CustomEvent).type === 'daw-seek');
      expect(seekEvent).toBeDefined();
    });
  });
});
