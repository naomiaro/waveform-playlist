// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDragPopoverHealer } from '../dragPopoverHealer';

/**
 * jsdom implements MutationObserver but not the Popover API, so each test
 * stubs `showPopover`/`matches` on the element directly — full control over
 * the open/closed signal without depending on jsdom popover support.
 */

const flushMutations = async () => {
  // MutationObserver callbacks are microtasks; a macrotask hop guarantees
  // they have run before assertions.
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('createDragPopoverHealer', () => {
  let container: HTMLDivElement;
  let sibling: HTMLDivElement;
  let element: HTMLDivElement;
  let showPopover: ReturnType<typeof vi.fn>;
  let popoverOpen: boolean;

  const stubPopover = (el: HTMLElement) => {
    showPopover = vi.fn(() => {
      popoverOpen = true;
    });
    Object.defineProperty(el, 'showPopover', {
      value: showPopover,
      configurable: true,
    });
    const nativeMatches = el.matches.bind(el);
    Object.defineProperty(el, 'matches', {
      value: (selector: string) =>
        selector === ':popover-open' ? popoverOpen : nativeMatches(selector),
      configurable: true,
    });
  };

  /** Simulate OptimisticSortingPlugin's insertAdjacentElement splice. */
  const spliceElement = () => {
    // remove + reinsert force-dismisses a shown popover without any events
    popoverOpen = false;
    sibling.insertAdjacentElement('afterend', element);
  };

  beforeEach(() => {
    container = document.createElement('div');
    sibling = document.createElement('div');
    element = document.createElement('div');
    element.setAttribute('popover', 'manual');
    container.appendChild(element);
    container.appendChild(sibling);
    document.body.appendChild(container);
    popoverOpen = true;
    stubPopover(element);
  });

  afterEach(() => {
    container.remove();
  });

  it('re-shows the popover after a DOM splice dismisses it', async () => {
    const disconnect = createDragPopoverHealer(element);
    spliceElement();
    await flushMutations();
    expect(showPopover).toHaveBeenCalledTimes(1);
    disconnect();
  });

  it('heals repeatedly across successive splices', async () => {
    const disconnect = createDragPopoverHealer(element);
    spliceElement();
    await flushMutations();
    spliceElement();
    await flushMutations();
    expect(showPopover).toHaveBeenCalledTimes(2);
    disconnect();
  });

  it('does not call showPopover while the popover is still open', async () => {
    const disconnect = createDragPopoverHealer(element);
    // unrelated mutation elsewhere in the document
    document.body.appendChild(document.createElement('span'));
    await flushMutations();
    expect(showPopover).not.toHaveBeenCalled();
    disconnect();
  });

  it('does not call showPopover while the element is disconnected', async () => {
    const disconnect = createDragPopoverHealer(element);
    popoverOpen = false;
    element.remove(); // removed but NOT reinserted
    await flushMutations();
    expect(showPopover).not.toHaveBeenCalled();
    disconnect();
  });

  it('does nothing when the element has no popover attribute', async () => {
    element.removeAttribute('popover');
    const disconnect = createDragPopoverHealer(element);
    spliceElement();
    await flushMutations();
    expect(showPopover).not.toHaveBeenCalled();
    disconnect();
  });

  it('stops healing after disconnect', async () => {
    const disconnect = createDragPopoverHealer(element);
    disconnect();
    spliceElement();
    await flushMutations();
    expect(showPopover).not.toHaveBeenCalled();
  });

  it('swallows showPopover errors', async () => {
    showPopover.mockImplementation(() => {
      throw new DOMException('InvalidStateError');
    });
    const disconnect = createDragPopoverHealer(element);
    spliceElement();
    await flushMutations();
    expect(showPopover).toHaveBeenCalled();
    disconnect();
  });

  it('is a no-op when showPopover is unsupported', async () => {
    const bare = document.createElement('div');
    bare.setAttribute('popover', 'manual');
    container.appendChild(bare);
    // no showPopover stub — simulates a browser without the Popover API
    const disconnect = createDragPopoverHealer(bare);
    sibling.insertAdjacentElement('afterend', bare);
    await flushMutations();
    disconnect(); // must not throw
  });
});
