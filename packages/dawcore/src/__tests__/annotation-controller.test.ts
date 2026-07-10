import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../elements/daw-annotation';
import '../elements/daw-annotation-track';
import { AnnotationController, ANNOTATION_LANE_HEIGHT } from '../controllers/annotation-controller';
import type { DawAnnotationTrackElement } from '../elements/daw-annotation-track';

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeHost() {
  const host = document.createElement('div') as unknown as HTMLElement & {
    effectiveSampleRate: number;
    _renderSpp: number;
    seekTo: ReturnType<typeof vi.fn>;
    addController: ReturnType<typeof vi.fn>;
    removeController: ReturnType<typeof vi.fn>;
    requestUpdate: ReturnType<typeof vi.fn>;
    updateComplete: Promise<boolean>;
  };
  Object.assign(host, {
    effectiveSampleRate: 48000,
    _renderSpp: 1024,
    seekTo: vi.fn(),
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
  });
  document.body.appendChild(host);
  return host;
}

describe('AnnotationController', () => {
  let host: ReturnType<typeof makeHost>;
  let controller: AnnotationController;
  let track: DawAnnotationTrackElement;

  beforeEach(async () => {
    host = makeHost();
    controller = new AnnotationController(host as never);
    controller.hostConnected();
    track = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track.innerHTML = '<daw-annotation id="a" start="1" end="3">Hi</daw-annotation>';
    host.appendChild(track);
    await flush();
    controller.handleTrackConnected(track);
  });

  afterEach(() => {
    controller.hostDisconnected();
    host.remove();
  });

  it('registers connected tracks and reports lane height', () => {
    expect(controller.tracks).toEqual([track]);
    expect(controller.totalLaneHeight).toBe(ANNOTATION_LANE_HEIGHT);
  });

  it('deduplicates repeat registration of the same track', () => {
    controller.handleTrackConnected(track);
    expect(controller.tracks).toHaveLength(1);
  });

  it('unregisters a track removed from the DOM and requests an update', async () => {
    track.remove();
    await flush();
    expect(controller.tracks).toEqual([]);
    expect(host.requestUpdate).toHaveBeenCalled();
  });

  it('computes box pixel geometry from spp and sample rate', () => {
    // start 1s → 1 * 48000 / 1024 = 46.875 → floor 46
    // end 3s → 140.625 → floor 140; width = 94
    const geo = controller.boxGeometry({ id: 'a', start: 1, end: 3, lines: ['Hi'] }, 1024, 48000);
    expect(geo).toEqual({ left: 46, width: 94 });
  });

  it('requests a host update on daw-annotation-update bubbling through the host', async () => {
    host.requestUpdate.mockClear();
    const el = track.querySelector('daw-annotation')! as HTMLElement & { end: number };
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    el.end = 5;
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(host.requestUpdate).toHaveBeenCalled();
  });
});
