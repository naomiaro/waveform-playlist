import { test, expect } from '@playwright/test';

/**
 * Track name lives in a sibling `span` (ellipsis-truncated inline style) inside
 * the same Controls panel as the move buttons: button -> ReorderRail -> Controls.
 */
function trackNameFromButton(btn: Element): string | null {
  const panel = btn.closest('div')?.parentElement;
  return panel?.querySelector<HTMLElement>('span[style*="ellipsis"]')?.textContent ?? null;
}

test.describe('Track Reordering', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/stem-tracks`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
  });

  test('move down button swaps track order', async ({ page }) => {
    const firstPanelName = await page
      .locator('button[aria-label="Move track down"]')
      .first()
      .evaluate(trackNameFromButton);

    await page.getByRole('button', { name: 'Move track down' }).first().click();

    await expect(async () => {
      const nowSecondName = await page
        .locator('button[aria-label="Move track down"]')
        .nth(1)
        .evaluate(trackNameFromButton);
      expect(nowSecondName).toBe(firstPanelName);
    }).toPass({ timeout: 5000 });
  });

  test('move up is disabled on the first track, move down on the last', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Move track up' }).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Move track down' }).last()).toBeDisabled();
  });

  /**
   * Regression guard for a @dnd-kit/react sortable-plugin DOM-corruption bug
   * (see browser/CLAUDE.md "Track Reordering"): its Feedback and
   * OptimisticSortingPlugin plugins splice React-owned DOM nodes
   * (insertAdjacentElement / replaceWith) outside React's reconciler during
   * a drag. That desyncs React's fiber tree from the true DOM for the
   * track-controls column — the underlying data (and the canvas track area,
   * which isn't wrapped by useSortable) keeps reordering correctly, but the
   * panel's own DOM order gets stuck, so the *name* silently stops following
   * its track on every later reorder (drag OR button) for the rest of the
   * session. Only a real, ground-truth DOM order check across BOTH the
   * canvas (`data-track-id`) and the panel (name span) — before, after a
   * drag, and after a subsequent button click — can catch this; the
   * existing "move down button" test above never drags, so it never
   * exercised the code path where the corruption is introduced.
   */
  test('drag reorders both track order and mixer identity (name follows)', async ({ page }) => {
    const readState = () =>
      page.evaluate(() => ({
        ids: [...document.querySelectorAll('[data-clip-container]')]
          .map((c) => ({ id: c.getAttribute('data-track-id'), top: c.getBoundingClientRect().top }))
          .sort((a, b) => a.top - b.top)
          .map((r) => r.id),
        names: [...document.querySelectorAll('span[style*="ellipsis"]')].map((s) => s.textContent),
      }));

    const before = await readState();
    expect(before.ids.length).toBeGreaterThan(1);

    const grips = page.locator('button[aria-label="Drag to reorder track"]');
    let g0: { x: number; y: number; width: number; height: number } | null = null;
    let g1: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      g0 = await grips.nth(0).boundingBox();
      g1 = await grips.nth(1).boundingBox();
      expect(g0).toBeTruthy();
      expect(g1).toBeTruthy();
    }).toPass({ timeout: 5000 });
    if (!g0 || !g1) throw new Error('Grip elements not laid out');
    const box0 = g0 as { x: number; y: number; width: number; height: number };
    const box1 = g1 as { x: number; y: number; width: number; height: number };

    // Slow, granular real-mouse drag to grip 1's exact vertical center (the
    // calibrated one-slot distance). @dnd-kit/react's collision detector
    // samples position on animation frames — a couple of coarse
    // page.mouse.move(..., {steps}) calls fired back-to-back can outrun that
    // sampling and never register a collision; many discrete moves with a
    // short wait after each reliably crosses the boundary.
    const startY = box0.y + box0.height / 2;
    const endY = box1.y + box1.height / 2;
    await page.mouse.move(box0.x + box0.width / 2, startY);
    await page.mouse.down();
    await page.waitForTimeout(50);
    for (let i = 1; i <= 15; i++) {
      const y = startY + ((endY - startY) * i) / 15;
      await page.mouse.move(box0.x + box0.width / 2, y);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(300);

    // Mid-drag, after crossing the collision boundary: the dragged row must
    // still be visible. OptimisticSortingPlugin's insertAdjacentElement
    // splice force-dismisses dnd-kit's top-layer popover (eventlessly), and
    // a dismissed [popover] element is UA-hidden (display: none) — the
    // dragPopoverHealer in SortableTrackControls must have re-shown it.
    const midDrag = await page.evaluate(() => {
      const el = document.querySelector('[data-dnd-dragging]');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { popoverOpen: el.matches(':popover-open'), height: rect.height };
    });
    expect(midDrag).not.toBeNull();
    expect(midDrag?.popoverOpen).toBe(true);
    expect(midDrag?.height).toBeGreaterThan(0);

    // Slot-snap preview: after crossing the boundary the WAVEFORM column
    // already shows the previewed order (rect-top order of the row wrappers),
    // and the dragged row carries the emphasis attribute. Row wrappers carry
    // a unique `data-track-row` marker (Clip and channel-container elements
    // inside each row also carry `data-track-id`, so that alone is
    // ambiguous).
    await expect(async () => {
      const midDragWaveformOrder = await page.evaluate(() =>
        [...document.querySelectorAll('[data-track-row]')]
          .map((el) => ({
            id: el.getAttribute('data-track-id'),
            top: el.getBoundingClientRect().top,
            isDragSource: el.hasAttribute('data-track-drag-source'),
          }))
          .sort((a, b) => a.top - b.top)
      );
      expect(midDragWaveformOrder[0]?.id).toBe(before.ids[1]);
      expect(midDragWaveformOrder[1]?.id).toBe(before.ids[0]);
      expect(midDragWaveformOrder[1]?.isDragSource).toBe(true);
      expect(midDragWaveformOrder.filter((r) => r.isDragSource)).toHaveLength(1);
    }).toPass({ timeout: 5000 });

    await page.mouse.up();

    await expect(async () => {
      const afterDrag = await readState();
      expect(afterDrag.ids[0]).toBe(before.ids[1]);
      expect(afterDrag.ids[1]).toBe(before.ids[0]);
      expect(afterDrag.names[0]).toBe(before.names[1]);
      expect(afterDrag.names[1]).toBe(before.names[0]);
    }).toPass({ timeout: 5000 });

    await expect(page.locator('[data-track-drag-source]')).toHaveCount(0);

    // Restore via the move-up button and confirm BOTH order and name follow
    // back — this second reorder is what the corruption bug broke: names
    // stayed frozen even though ids kept moving correctly.
    await page.locator('button[aria-label="Move track up"]').nth(1).click();

    await expect(async () => {
      const restored = await readState();
      expect(restored.ids).toEqual(before.ids);
      expect(restored.names).toEqual(before.names);
    }).toPass({ timeout: 5000 });
  });

  test('Escape mid-drag reverts the preview in both columns', async ({ page }) => {
    const readState = () =>
      page.evaluate(() => ({
        ids: [...document.querySelectorAll('[data-clip-container]')]
          .map((c) => ({ id: c.getAttribute('data-track-id'), top: c.getBoundingClientRect().top }))
          .sort((a, b) => a.top - b.top)
          .map((r) => r.id),
        names: [...document.querySelectorAll('span[style*="ellipsis"]')].map((s) => s.textContent),
      }));
    const before = await readState();

    const grips = page.locator('button[aria-label="Drag to reorder track"]');
    let g0: { x: number; y: number; width: number; height: number } | null = null;
    let g1: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      g0 = await grips.nth(0).boundingBox();
      g1 = await grips.nth(1).boundingBox();
      expect(g0).toBeTruthy();
      expect(g1).toBeTruthy();
    }).toPass({ timeout: 5000 });
    if (!g0 || !g1) throw new Error('Grip elements not laid out');
    const box0 = g0 as { x: number; y: number; width: number; height: number };
    const box1 = g1 as { x: number; y: number; width: number; height: number };
    const startY = box0.y + box0.height / 2;
    const endY = box1.y + box1.height / 2;
    await page.mouse.move(box0.x + box0.width / 2, startY);
    await page.mouse.down();
    for (let i = 1; i <= 15; i++) {
      await page.mouse.move(box0.x + box0.width / 2, startY + ((endY - startY) * i) / 15);
      await page.waitForTimeout(60);
    }
    // Preview active: order swapped, emphasis present
    await expect(async () => {
      const mid = await readState();
      expect(mid.ids[0]).toBe(before.ids[1]);
    }).toPass({ timeout: 5000 });
    await expect(page.locator('[data-track-drag-source]')).toHaveCount(1);

    await page.keyboard.press('Escape');
    await page.mouse.up();

    // Reverted: original order in BOTH the waveform column (ids) and the
    // mixer/name column (names) — this is exactly where the historical
    // OptimisticSortingPlugin DOM-corruption bug manifested (see the drag
    // test above), so a revert check must cover names too, not just ids.
    await expect(async () => {
      const restored = await readState();
      expect(restored.ids).toEqual(before.ids);
      expect(restored.names).toEqual(before.names);
    }).toPass({ timeout: 5000 });
    await expect(page.locator('[data-track-drag-source]')).toHaveCount(0);
  });
});
