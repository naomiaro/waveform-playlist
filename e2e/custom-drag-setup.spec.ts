import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * /examples/custom-drag-setup (#690): clip editing with the app's own
 * DragDropProvider instead of ClipInteractionProvider. The clips learn what
 * they may do from `ClipInteractionOptions` alone; `Waveform` has no prop for
 * it. Two checkboxes on the page drive its `enabled` and `touchOptimized`.
 *
 * Layout: 1024 samples per pixel at 48 kHz is 46.875 px per second.
 *   Kick   0-6 s and 10-16 s   (clips 0 and 1)
 *   Claps  4-8 s and 12-16 s   (clips 2 and 3)
 *   Bass   2-14 s              (clip 4)
 */

const PX_PER_SECOND = 48000 / 1024;
const HANDLE = '[data-boundary-edge]';

const clip = (page: Page, index: number) => page.locator('[data-clip-container]').nth(index);

/** Left and width of a clip on the timeline, in px, from its inline style. */
async function geometry(locator: Locator) {
  return locator.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return { left: parseFloat(style.left), width: parseFloat(style.width) };
  });
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  let result: { x: number; y: number; width: number; height: number } | null = null;
  await expect(async () => {
    result = await locator.boundingBox();
    expect(result).toBeTruthy();
  }).toPass({ timeout: 5000 });
  return result!;
}

/** Press at a point, move horizontally in small steps (dnd-kit samples per frame), release. */
async function dragBy(page: Page, x: number, y: number, dx: number) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
}

/** Drags a clip by its header: the strip at the top of the clip container. */
async function dragHeader(page: Page, index: number, dx: number) {
  const b = await box(clip(page, index));
  await dragBy(page, b.x + 40, b.y + 8, dx);
}

async function handleWidths(page: Page) {
  return page
    .locator(HANDLE)
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
}

const interactiveBox = (page: Page) =>
  page.getByRole('checkbox', { name: 'Clips can be dragged and trimmed' });
const touchBox = (page: Page) => page.getByRole('checkbox', { name: /Touch-optimized/ });

test.describe('Custom Drag Setup Example', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/custom-drag-setup`);
    await page.waitForSelector('h1:has-text("Custom Drag Setup")', { timeout: 30000 });
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
    await expect(page.locator('[data-clip-container]')).toHaveCount(5);
    // Two trim handles per clip once the clips are interactive.
    await expect(page.locator(HANDLE)).toHaveCount(10);
  });

  test('clips start where the page puts them, with 8px trim handles', async ({ page }) => {
    await expect(async () => {
      const second = await geometry(clip(page, 1));
      // Positions are whole pixels: within 1 px of the exact value.
      expect(Math.abs(second.left - 10 * PX_PER_SECOND)).toBeLessThanOrEqual(1);
      expect(Math.abs(second.width - 6 * PX_PER_SECOND)).toBeLessThanOrEqual(1);
      expect(new Set(await handleWidths(page))).toEqual(new Set([8]));
    }).toPass({ timeout: 5000 });
  });

  test('dragging a clip header moves the clip by the distance dragged', async ({ page }) => {
    const before = await geometry(clip(page, 1));

    await dragHeader(page, 1, -60);

    await expect(async () => {
      const after = await geometry(clip(page, 1));
      expect(Math.abs(after.left - (before.left - 60))).toBeLessThanOrEqual(2);
      expect(after.width).toBeCloseTo(before.width, 0);
    }).toPass({ timeout: 5000 });
  });

  test('a dragged clip stops at its neighbour (collision modifier)', async ({ page }) => {
    const first = await geometry(clip(page, 0));

    // 4 s of free space (187.5 px) between the two Kick clips; drag much further.
    await dragHeader(page, 1, -400);

    await expect(async () => {
      const after = await geometry(clip(page, 1));
      expect(Math.abs(after.left - (first.left + first.width))).toBeLessThanOrEqual(1);
    }).toPass({ timeout: 5000 });
  });

  test('dragging a right trim handle shortens the clip and leaves its start alone', async ({
    page,
  }) => {
    const before = await geometry(clip(page, 0));
    const handle = clip(page, 0).locator('[data-boundary-edge="right"]');
    const b = await box(handle);

    await dragBy(page, b.x + b.width / 2, b.y + b.height / 2, -40);

    await expect(async () => {
      const after = await geometry(clip(page, 0));
      expect(Math.abs(after.width - (before.width - 40))).toBeLessThanOrEqual(2);
      expect(after.left).toBeCloseTo(before.left, 0);
    }).toPass({ timeout: 5000 });
  });

  test('dragging a left trim handle moves the start and keeps the end', async ({ page }) => {
    const before = await geometry(clip(page, 1));
    const handle = clip(page, 1).locator('[data-boundary-edge="left"]');
    const b = await box(handle);

    await dragBy(page, b.x + b.width / 2, b.y + b.height / 2, 30);

    await expect(async () => {
      const after = await geometry(clip(page, 1));
      expect(Math.abs(after.left - (before.left + 30))).toBeLessThanOrEqual(2);
      expect(Math.abs(after.left + after.width - (before.left + before.width))).toBeLessThanOrEqual(
        2
      );
    }).toPass({ timeout: 5000 });
  });

  test('with interaction switched off there are no trim handles and a header drag moves nothing', async ({
    page,
  }) => {
    await interactiveBox(page).uncheck();
    await expect(page.locator(HANDLE)).toHaveCount(0);
    const before = await geometry(clip(page, 1));

    await dragHeader(page, 1, -60);
    // Give a move that should not happen the time a real one takes.
    await page.waitForTimeout(500);

    const after = await geometry(clip(page, 1));
    expect(after.left).toBeCloseTo(before.left, 0);
    expect(after.width).toBeCloseTo(before.width, 0);
  });

  test('switching interaction back on restores handles and dragging', async ({ page }) => {
    await interactiveBox(page).uncheck();
    await expect(page.locator(HANDLE)).toHaveCount(0);
    await interactiveBox(page).check();
    await expect(page.locator(HANDLE)).toHaveCount(10);
    const before = await geometry(clip(page, 1));

    await dragHeader(page, 1, -60);

    await expect(async () => {
      const after = await geometry(clip(page, 1));
      expect(Math.abs(after.left - (before.left - 60))).toBeLessThanOrEqual(2);
    }).toPass({ timeout: 5000 });
  });

  test('touch-optimized widens every trim handle to 24px, and back to 8px', async ({ page }) => {
    await touchBox(page).check();
    await expect(async () => {
      const widths = await handleWidths(page);
      expect(widths).toHaveLength(10);
      expect(new Set(widths)).toEqual(new Set([24]));
    }).toPass({ timeout: 5000 });

    await touchBox(page).uncheck();
    await expect(async () => {
      expect(new Set(await handleWidths(page))).toEqual(new Set([8]));
    }).toPass({ timeout: 5000 });
  });

  test('with touch-optimized on, a mouse still drags and trims', async ({ page }) => {
    await touchBox(page).check();
    await expect(async () => {
      expect(new Set(await handleWidths(page))).toEqual(new Set([24]));
    }).toPass({ timeout: 5000 });
    const before = await geometry(clip(page, 1));

    await dragHeader(page, 1, -60);
    await expect(async () => {
      const moved = await geometry(clip(page, 1));
      expect(Math.abs(moved.left - (before.left - 60))).toBeLessThanOrEqual(2);
    }).toPass({ timeout: 5000 });

    const moved = await geometry(clip(page, 1));
    const handle = clip(page, 1).locator('[data-boundary-edge="right"]');
    const b = await box(handle);
    await dragBy(page, b.x + b.width / 2, b.y + b.height / 2, -40);
    await expect(async () => {
      const trimmed = await geometry(clip(page, 1));
      expect(Math.abs(trimmed.width - (moved.width - 40))).toBeLessThanOrEqual(2);
    }).toPass({ timeout: 5000 });
  });

  test('touch-optimized without interaction shows no handles', async ({ page }) => {
    await interactiveBox(page).uncheck();
    await touchBox(page).check();
    await expect(page.locator(HANDLE)).toHaveCount(0);
  });

  test('playback still starts after an edit', async ({ page }) => {
    await dragHeader(page, 1, -60);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled({
      timeout: 10000,
    });
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
  });
});
