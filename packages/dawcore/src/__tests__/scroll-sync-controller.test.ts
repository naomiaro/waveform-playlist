import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrollSyncController } from '../controllers/scroll-sync-controller';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function makeHost() {
  const el = document.createElement('div');
  el.attachShadow({ mode: 'open' });
  el.shadowRoot!.innerHTML = `
    <div class="header-row">
      <div class="ruler-viewport"><div class="ruler-content"></div></div>
    </div>
    <div class="body">
      <div class="controls-viewport"><div class="controls-column"></div></div>
      <div class="scroll-area"><div class="timeline"></div></div>
    </div>`;
  (el as any).addController = vi.fn();
  (el as any).requestUpdate = vi.fn();
  document.body.appendChild(el);
  return el as unknown as HTMLElement & {
    addController: ReturnType<typeof vi.fn>;
    requestUpdate: ReturnType<typeof vi.fn>;
  };
}

function makeController(host: ReturnType<typeof makeHost>) {
  const c = new ScrollSyncController(host as any);
  c.scrollSelector = '.scroll-area';
  c.xTargetSelector = '.ruler-content';
  c.yTargetSelector = '.controls-column';
  c.wheelForwardSelector = '.controls-viewport';
  return c;
}

function makeControllerMulti(host: ReturnType<typeof makeHost>) {
  const c = new ScrollSyncController(host as any);
  c.scrollSelector = '.scroll-area';
  c.xTargetSelector = '.ruler-content';
  c.yTargetSelector = '.controls-column';
  c.wheelForwardSelector = '.controls-viewport, .ruler-viewport';
  return c;
}

function q(host: HTMLElement, sel: string): HTMLElement {
  return host.shadowRoot!.querySelector(sel) as HTMLElement;
}

describe('ScrollSyncController', () => {
  let host: ReturnType<typeof makeHost>;

  beforeEach(() => {
    host = makeHost();
  });

  afterEach(() => {
    host.remove();
    vi.restoreAllMocks();
  });

  it('registers itself with the host', () => {
    const controller = makeController(host);
    expect((host as any).addController).toHaveBeenCalledWith(controller);
  });

  it('applies transforms to x and y targets on scroll', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    sa.scrollLeft = 120;
    sa.scrollTop = 45;
    sa.dispatchEvent(new Event('scroll'));

    expect(q(host, '.ruler-content').style.transform).toBe('translate3d(-120px, 0, 0)');
    expect(q(host, '.controls-column').style.transform).toBe('translate3d(0, -45px, 0)');
  });

  it('sync() applies the current scroll position without a scroll event', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    sa.scrollLeft = 300;
    controller.sync();

    expect(q(host, '.ruler-content').style.transform).toBe('translate3d(-300px, 0, 0)');
  });

  it('forwards wheel deltaY to the scroll container when vertically scrollable', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(sa, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(sa, 'clientWidth', { value: 200, configurable: true });
    sa.scrollTop = 0;

    const wheel = new WheelEvent('wheel', { deltaY: 50, cancelable: true });
    q(host, '.controls-viewport').dispatchEvent(wheel);

    expect(sa.scrollTop).toBe(50);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('does not forward wheel when neither axis can move (no scrollable room)', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    // Emulate a container with no scrollable room on either axis by stubbing
    // scrollLeft/scrollTop as non-writable so assignment doesn't change the value.
    // happy-dom has no layout engine, so we must stub manually.
    Object.defineProperty(sa, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(sa, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(sa, 'clientWidth', { value: 200, configurable: true });
    // Stub scrollTop/scrollLeft as clamped (assignment is a no-op, value stays 0).
    Object.defineProperty(sa, 'scrollTop', {
      get: () => 0,
      set: () => {},
      configurable: true,
    });
    Object.defineProperty(sa, 'scrollLeft', {
      get: () => 0,
      set: () => {},
      configurable: true,
    });

    const wheel = new WheelEvent('wheel', { deltaY: 50, cancelable: true });
    q(host, '.controls-viewport').dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(false);
  });

  it('stops syncing after hostDisconnected', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    controller.hostDisconnected();

    const sa = q(host, '.scroll-area');
    sa.scrollLeft = 999;
    sa.dispatchEvent(new Event('scroll'));

    expect(q(host, '.ruler-content').style.transform).not.toBe('translate3d(-999px, 0, 0)');
  });

  it('tolerates missing targets (header not rendered yet)', async () => {
    host.shadowRoot!.querySelector('.header-row')!.remove();
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    sa.scrollLeft = 50;
    const warnSpy = vi.spyOn(console, 'warn');
    expect(() => sa.dispatchEvent(new Event('scroll'))).not.toThrow();
    // Fix 1: warns once when scrolled and x target is missing
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('.ruler-content');
    // String(-0) === '0', so a zero scrollTop renders as plain 0px.
    expect(q(host, '.controls-column').style.transform).toBe('translate3d(0, 0px, 0)');
  });

  it('stops forwarding wheel events after hostDisconnected', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 200, configurable: true });
    sa.scrollTop = 0;

    controller.hostDisconnected();

    const wheel = new WheelEvent('wheel', { deltaY: 50, cancelable: true });
    q(host, '.controls-viewport').dispatchEvent(wheel);

    expect(sa.scrollTop).toBe(0);
    expect(wheel.defaultPrevented).toBe(false);
  });

  it('attaches to a replaced scroll container via sync()', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    // Remove the existing scroll-area and create a new one
    q(host, '.scroll-area').remove();
    const newSa = document.createElement('div');
    newSa.className = 'scroll-area';
    q(host, '.body').appendChild(newSa);

    // Add the timeline child to the new container
    const timeline = document.createElement('div');
    timeline.className = 'timeline';
    newSa.appendChild(timeline);

    // Call sync to re-attach to the new container
    controller.sync();

    Object.defineProperty(newSa, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(newSa, 'clientHeight', { value: 200, configurable: true });
    newSa.scrollLeft = 75;
    newSa.dispatchEvent(new Event('scroll'));

    expect(q(host, '.ruler-content').style.transform).toBe('translate3d(-75px, 0, 0)');
  });

  it('handles deltaMode line scrolling', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(sa, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(sa, 'clientWidth', { value: 200, configurable: true });
    sa.scrollTop = 0;

    const wheel = new WheelEvent('wheel', { deltaY: 3, cancelable: true });
    // happy-dom may not support deltaMode in constructor, set it via defineProperty
    Object.defineProperty(wheel, 'deltaMode', {
      value: WheelEvent.DOM_DELTA_LINE,
      configurable: true,
    });
    q(host, '.controls-viewport').dispatchEvent(wheel);

    // 3 lines * 16px per line = 48px
    expect(sa.scrollTop).toBe(48);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('does not prevent default when scroll does not move (boundary chaining)', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollHeight', { value: 100, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(sa, 'scrollWidth', { value: 200, configurable: true });
    Object.defineProperty(sa, 'clientWidth', { value: 200, configurable: true });
    // Already at the top, can't scroll further.
    // Stub scrollTop as clamped so the assignment is a no-op (no layout in happy-dom).
    Object.defineProperty(sa, 'scrollTop', {
      get: () => 0,
      set: () => {},
      configurable: true,
    });

    const wheel = new WheelEvent('wheel', { deltaY: -50, cancelable: true });
    q(host, '.controls-viewport').dispatchEvent(wheel);

    // Should not prevent default so page can continue scrolling
    expect(wheel.defaultPrevented).toBe(false);
  });

  // ── Multi-target + both-axes tests ──────────────────────────────────────

  it('forwards wheel deltaX over .ruler-viewport to scrollLeft (horizontal scrub)', async () => {
    const controller = makeControllerMulti(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(sa, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(sa, 'scrollHeight', { value: 300, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 300, configurable: true });
    sa.scrollLeft = 0;

    const wheel = new WheelEvent('wheel', { deltaX: 80, deltaY: 0, cancelable: true });
    q(host, '.ruler-viewport').dispatchEvent(wheel);

    // happy-dom does not clamp scrollLeft; assert directly
    expect(sa.scrollLeft).toBe(80);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('forwards both deltaX and deltaY in a single wheel event over a matched target', async () => {
    const controller = makeControllerMulti(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(sa, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(sa, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 200, configurable: true });
    sa.scrollLeft = 0;
    sa.scrollTop = 0;

    const wheel = new WheelEvent('wheel', { deltaX: 40, deltaY: 20, cancelable: true });
    q(host, '.controls-viewport').dispatchEvent(wheel);

    expect(sa.scrollLeft).toBe(40);
    expect(sa.scrollTop).toBe(20);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('does not prevent default over ruler-viewport when neither axis can move', async () => {
    const controller = makeControllerMulti(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollWidth', { value: 300, configurable: true });
    Object.defineProperty(sa, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(sa, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 200, configurable: true });
    // Stub both axes as clamped (no layout engine in happy-dom).
    Object.defineProperty(sa, 'scrollLeft', {
      get: () => 0,
      set: () => {},
      configurable: true,
    });
    Object.defineProperty(sa, 'scrollTop', {
      get: () => 0,
      set: () => {},
      configurable: true,
    });

    const wheel = new WheelEvent('wheel', { deltaX: 50, deltaY: 50, cancelable: true });
    q(host, '.ruler-viewport').dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(false);
  });

  it('stops forwarding wheel from all targets after hostDisconnected', async () => {
    const controller = makeControllerMulti(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(sa, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(sa, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 200, configurable: true });
    sa.scrollLeft = 0;

    controller.hostDisconnected();

    const wheel = new WheelEvent('wheel', { deltaX: 80, cancelable: true });
    q(host, '.ruler-viewport').dispatchEvent(wheel);

    expect(sa.scrollLeft).toBe(0);
    expect(wheel.defaultPrevented).toBe(false);
  });

  it('attaches wheel forwarding to targets that appear after sync()', async () => {
    // Remove .ruler-viewport before hostConnected so the controller doesn't
    // attach to it initially.
    const rulerViewport = host.shadowRoot!.querySelector('.ruler-viewport')!;
    rulerViewport.remove();

    const controller = makeControllerMulti(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(sa, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(sa, 'scrollHeight', { value: 300, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 300, configurable: true });
    sa.scrollLeft = 0;

    // Re-append .ruler-viewport and call sync() to pick it up
    const headerRow = host.shadowRoot!.querySelector('.header-row')!;
    const newRulerViewport = document.createElement('div');
    newRulerViewport.className = 'ruler-viewport';
    headerRow.appendChild(newRulerViewport);

    controller.sync();

    const wheel = new WheelEvent('wheel', { deltaX: 40, cancelable: true });
    newRulerViewport.dispatchEvent(wheel);

    expect(sa.scrollLeft).toBe(40);
  });

  it('detaches wheel forwarding from targets removed from the DOM', async () => {
    const controller = makeControllerMulti(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(sa, 'clientWidth', { value: 300, configurable: true });
    Object.defineProperty(sa, 'scrollHeight', { value: 300, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 300, configurable: true });
    sa.scrollLeft = 0;

    // Remove .ruler-viewport from DOM and call sync() so the controller diffs it out
    const rulerViewport = host.shadowRoot!.querySelector('.ruler-viewport') as HTMLElement;
    rulerViewport.remove();
    controller.sync();

    // Re-append WITHOUT calling sync — listener should have been removed
    host.shadowRoot!.querySelector('.header-row')!.appendChild(rulerViewport);

    const wheel = new WheelEvent('wheel', { deltaX: 40, cancelable: true });
    rulerViewport.dispatchEvent(wheel);

    expect(sa.scrollLeft).toBe(0);
    expect(wheel.defaultPrevented).toBe(false);
  });
});
