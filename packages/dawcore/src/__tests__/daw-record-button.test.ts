import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-record-button');
  await import('../elements/daw-transport');
});

describe('DawRecordButtonElement', () => {
  afterEach(() => {
    // Failed assertions skip trailing in-test cleanup — reset here so a
    // failure can't leak orphan elements into the next describe.
    document.body.innerHTML = '';
  });

  it('is registered as a custom element', () => {
    expect(customElements.get('daw-record-button')).toBeDefined();
  });

  it('renders a button with Record slot', async () => {
    const el = document.createElement('daw-record-button') as any;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 10));
    const button = el.shadowRoot?.querySelector('button');
    expect(button).toBeTruthy();
    document.body.removeChild(el);
  });

  it('stays enabled while the target is missing (click-time resolution warns instead of latching disabled)', async () => {
    const el = document.createElement('daw-record-button') as any;
    document.body.appendChild(el);
    // Wait for connectedCallback rAF + Lit update
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    await el.updateComplete;

    const button = el.shadowRoot?.querySelector('button');
    expect(button?.disabled).toBe(false);
    document.body.removeChild(el);
  });
});

describe('daw-record-button capability detection (#474 foundation)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  /** Wait one real animation frame (button defers target work via rAF). */
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

  function mount(targetSetup: (el: HTMLElement) => void) {
    const fake = document.createElement('div');
    fake.id = 'fake-target';
    targetSetup(fake);
    document.body.appendChild(fake);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="fake-target"><daw-record-button></daw-record-button></daw-transport>'
    );
    return document.querySelector('daw-record-button')! as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
  }

  it('renders enabled against a target implementing startRecording/stopRecording', async () => {
    const button = mount((el) => {
      Object.assign(el, { startRecording: () => {}, stopRecording: () => {} });
    });
    await nextFrame();
    await button.updateComplete;
    const inner = button.shadowRoot!.querySelector('button')!;
    expect(inner.disabled).toBe(false);
  });

  it('renders disabled against a target lacking the methods', async () => {
    const button = mount(() => {});
    await nextFrame();
    await button.updateComplete;
    const inner = button.shadowRoot!.querySelector('button')!;
    expect(inner.disabled).toBe(true);
  });

  it('warns once on first pointer interaction with an unsupported control', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const button = mount(() => {});
    await nextFrame();
    await button.updateComplete;
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('startRecording');
  });

  it('enables once a late target appears', async () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="late-target"><daw-record-button></daw-record-button></daw-transport>'
    );
    const button = document.querySelector('daw-record-button')! as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await nextFrame();
    await button.updateComplete;
    const inner = button.shadowRoot!.querySelector('button')!;
    // Benefit of the doubt: no latching disabled while the target is missing.
    expect(inner.disabled).toBe(false);

    const startRecording = vi.fn();
    const late = document.createElement('div');
    late.id = 'late-target';
    Object.assign(late, { startRecording, stopRecording: vi.fn() });
    document.body.appendChild(late);

    button.dispatchEvent(new Event('pointerenter', { bubbles: true }));
    await button.updateComplete;
    expect(inner.disabled).toBe(false);
    inner.click();
    expect(startRecording).toHaveBeenCalled();
  });

  it('warns once on pointer interaction when the transport target is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="does-not-exist"><daw-record-button></daw-record-button></daw-transport>'
    );
    const button = document.querySelector('daw-record-button')! as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    await button.updateComplete;
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('no target');
  });
});
