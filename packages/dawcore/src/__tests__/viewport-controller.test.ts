import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReactiveControllerHost } from 'lit';
import { ViewportController } from '../controllers/viewport-controller';
import { probeListeners } from './helpers/listener-probe';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function makeHost(): ReactiveControllerHost & HTMLElement {
  const el = document.createElement('div');
  el.attachShadow({ mode: 'open' });
  el.shadowRoot!.innerHTML = '<div class="scroll-area"></div>';
  document.body.appendChild(el);
  return Object.assign(el, {
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
  });
}

function scrollArea(host: HTMLElement): HTMLElement {
  return host.shadowRoot!.querySelector('.scroll-area') as HTMLElement;
}

describe('ViewportController: its scroll listener (D8, #848)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('is attached to the scroll container and removed on hostDisconnected', async () => {
    const host = makeHost();
    const container = probeListeners(scrollArea(host));
    const controller = new ViewportController(host);
    controller.scrollSelector = '.scroll-area';
    controller.hostConnected();
    await nextFrame();
    expect(container.live('scroll')).toBe(1);
    controller.hostDisconnected();
    expect(container.live('scroll')).toBe(0);
  });

  it('attaching to another scroll container leaves none on the first', async () => {
    const host = makeHost();
    const old = probeListeners(scrollArea(host));
    const controller = new ViewportController(host);
    controller.scrollSelector = '.scroll-area';
    controller.hostConnected();
    await nextFrame();
    // Attaching to another container replaces the listener on the first.
    const replacement = document.createElement('div');
    replacement.className = 'scroll-area';
    scrollArea(host).replaceWith(replacement);
    const next = probeListeners(scrollArea(host));
    controller.hostConnected();
    await nextFrame();
    expect(old.live('scroll')).toBe(0);
    expect(next.live('scroll')).toBe(1);
  });
});
