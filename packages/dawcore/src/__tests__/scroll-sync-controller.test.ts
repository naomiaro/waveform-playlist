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
    sa.scrollTop = 0;

    const wheel = new WheelEvent('wheel', { deltaY: 50, cancelable: true });
    q(host, '.controls-viewport').dispatchEvent(wheel);

    expect(sa.scrollTop).toBe(50);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('does not forward wheel when not vertically scrollable', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 200, configurable: true });
    sa.scrollTop = 0;

    const wheel = new WheelEvent('wheel', { deltaY: 50, cancelable: true });
    q(host, '.controls-viewport').dispatchEvent(wheel);

    expect(sa.scrollTop).toBe(0);
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
    expect(() => sa.dispatchEvent(new Event('scroll'))).not.toThrow();
    // String(-0) === '0', so a zero scrollTop renders as plain 0px.
    expect(q(host, '.controls-column').style.transform).toBe('translate3d(0, 0px, 0)');
  });
});
