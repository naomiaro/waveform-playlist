/**
 * React editor: undo during a drag does nothing, and Escape cancels the drag
 * and does nothing else (#848, #906). dnd-kit's pointer sensor cancels a drag
 * on Escape and prevents the key's default; core's handleKeyboardEvent then
 * leaves the Escape alone, so playback goes on.
 */
import { test, expect, type Page } from '@playwright/test';

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: ReturnType<Page['locator']>, { scroll = true } = {}): Promise<Box> {
  await expect(locator).toBeVisible();
  if (scroll) await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  let box: Box | null = null;
  await expect(async () => {
    box = await locator.boundingBox();
    expect(box).toBeTruthy();
  }).toPass({ timeout: 5000 });
  return box!;
}

/** Many small moves with a pause after each: dnd-kit samples on animation frames. */
async function glide(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  { steps = 12, pause = 30 } = {}
) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    await page.waitForTimeout(pause);
  }
}

// The pacing of track-reorder.spec.ts: a pause after the press, 15 moves 60 ms apart.
const SORTABLE = { steps: 15, pause: 60 };

test.describe('React: undo and Escape during a clip drag (#848)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/multi-clip`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
  });

  /** The last clip on the page (the end of its track: room to its right). */
  const lastClip = (page: Page) => page.locator('[data-clip-container]').last();

  /** The clip's left edge in timeline pixels (independent of scrolling). */
  const leftOf = (page: Page) =>
    lastClip(page).evaluate((el) => {
      const scroller = el.closest('[data-scroll-container]') as HTMLElement;
      return Math.round(
        el.getBoundingClientRect().left -
          scroller.getBoundingClientRect().left +
          scroller.scrollLeft
      );
    });

  async function pressHeader(page: Page) {
    const header = lastClip(page).locator('[data-clip-id]:not([data-boundary-edge])');
    const box = await boxOf(header);
    const point = { x: box.x + Math.min(40, box.width / 2), y: box.y + box.height / 2 };
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    return point;
  }

  const near = async (page: Page, expected: number) =>
    expect(async () => {
      expect(Math.abs((await leftOf(page)) - expected)).toBeLessThanOrEqual(1);
    }).toPass({ timeout: 5000 });

  test('undo during a clip move does nothing (multi-clip)', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'warning') warnings.push(m.text());
    });
    const start = await leftOf(page);

    let p = await pressHeader(page);
    await glide(page, p, { x: p.x + 40, y: p.y });
    await page.mouse.up();
    await near(page, start + 40);

    p = await pressHeader(page);
    await glide(page, p, { x: p.x + 60, y: p.y });
    await page.keyboard.press('ControlOrMeta+z');
    await glide(page, { x: p.x + 60, y: p.y }, { x: p.x + 120, y: p.y });
    await page.mouse.up();
    await near(page, start + 160);

    await page.keyboard.press('ControlOrMeta+z');
    await near(page, start + 40);
    await page.keyboard.press('ControlOrMeta+z');
    await near(page, start);
    expect(warnings.filter((w) => w.includes('no active transaction'))).toEqual([]);
  });

  test('Escape during a clip move cancels it and keeps playing (multi-clip)', async ({ page }) => {
    const start = await leftOf(page);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
    await expect(async () => {
      expect(await timeDisplay.textContent()).not.toBe('00:00:00.000');
    }).toPass({ timeout: 10000 });

    const p = await pressHeader(page);
    await glide(page, p, { x: p.x + 60, y: p.y });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await near(page, start);

    // Still playing: the time moves on.
    const before = await timeDisplay.textContent();
    await expect(async () => {
      expect(await timeDisplay.textContent()).not.toBe(before);
    }).toPass({ timeout: 5000 });

    // With no drag left, Escape is Stop again.
    await page.keyboard.press('Escape');
    const stopped = await timeDisplay.textContent();
    await page.waitForTimeout(300);
    expect(await timeDisplay.textContent()).toBe(stopped);
  });
});

test.describe('React: undo during a track drag (#906)', () => {
  test('undo during a track-reorder drag does nothing, and the panels stay in DOM order (stem-tracks)', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/examples/stem-tracks`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
    const grips = page.locator('button[aria-label="Drag to reorder track"]');
    await expect(async () => {
      expect(await grips.count()).toBeGreaterThanOrEqual(3);
    }).toPass({ timeout: 30000 });

    const names = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-track-controls]')].map(
          (el) => el.querySelector('[data-track-name]')?.textContent ?? ''
        )
      );
    const namesOnScreen = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[data-track-controls]')]
          .map((el) => ({
            name: el.querySelector('[data-track-name]')?.textContent ?? '',
            top: el.getBoundingClientRect().top,
          }))
          .sort((a, b) => a.top - b.top)
          .map((r) => r.name)
      );

    // Drag track 0 onto track 1 and drop: one undo step.
    const before = await names();
    const g0 = await boxOf(grips.nth(0));
    // Read after grip 0 is scrolled to the middle: no second scroll.
    const g1 = await boxOf(grips.nth(1), { scroll: false });
    const from0 = { x: g0.x + g0.width / 2, y: g0.y + g0.height / 2 };
    await page.mouse.move(from0.x, from0.y);
    await page.mouse.down();
    await page.waitForTimeout(50);
    await glide(page, from0, { x: from0.x, y: g1.y + g1.height / 2 }, SORTABLE);
    await page.waitForTimeout(300);
    await page.mouse.up();
    await expect.poll(names).toEqual([before[1], before[0], ...before.slice(2)]);
    const afterDrop = await names();

    // Start a drag of row 2, undo with the button held, release in place.
    const g2 = await boxOf(grips.nth(2));
    const from2 = { x: g2.x + g2.width / 2, y: g2.y + g2.height / 2 };
    await page.mouse.move(from2.x, from2.y);
    await page.mouse.down();
    await page.waitForTimeout(50);
    await glide(page, from2, { x: from2.x, y: from2.y + 12 }, SORTABLE);
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForTimeout(300);
    await glide(page, { x: from2.x, y: from2.y + 12 }, from2, SORTABLE);
    await page.mouse.up();
    await page.waitForTimeout(500);

    expect(await names()).toEqual(afterDrop);
    expect(await namesOnScreen()).toEqual(await names());
  });
});
