import { test, expect } from '@playwright/test';

/**
 * Multi-clip interaction tests
 *
 * These tests verify the core clip editing interactions:
 * - Playhead positioning (clicking on waveform)
 * - Clip dragging (dragging clip headers)
 * - Clip trimming (dragging clip boundaries)
 */

test.describe('Multi-Clip Example', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // Navigate using full URL to ensure correct path
    await page.goto(`${baseURL}/examples/multi-clip`);
    // Wait for Docusaurus to hydrate - check for the page title
    await page.waitForSelector('h1:has-text("Multi-Clip")', { timeout: 30000 });
    // Wait for playlist to be ready (all tracks loaded)
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
  });

  test('every track is an audio track (#756)', async ({ page }) => {
    const rows = page.locator('[data-track-row]');
    await expect(rows.first()).toBeVisible();
    // Retried as a whole: rows are still being added when the first one is
    // visible, so a count read once can be one short of the next read.
    await expect(async () => {
      const total = await rows.count();
      expect(total).toBeGreaterThan(0);
      expect(await page.locator('[data-track-row][data-track-kind="audio"]').count()).toBe(total);
      expect(await page.locator('[data-track-row]:not([data-track-kind="audio"])').count()).toBe(0);
    }).toPass({ timeout: 10000 });
  });

  test.describe('Playhead Positioning', () => {
    test('clicking on waveform area moves playhead', async ({ page }) => {
      // Get the first clip container - this ensures we click on actual waveform content
      const clipContainer = page.locator('[data-clip-container]').first();
      await expect(clipContainer).toBeVisible();

      // Wait for the element to have a non-null bounding box (layout complete)
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await clipContainer.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });

      // Click somewhere in the middle of the clip (not at the very start)
      const clickX = box!.x + box!.width / 2;
      const clickY = box!.y + box!.height / 2;

      await page.mouse.click(clickX, clickY);

      // The time display should have changed from 00:00:00.000
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      const timeText = await timeDisplay.textContent();

      // After clicking in the middle of the clip, time should not be 00:00:00.000
      // (exact value depends on zoom level and click position)
      expect(timeText).not.toBe('00:00:00.000');
    });

    test('playhead lands exactly where clicked (no latency offset)', async ({ page }) => {
      const clipContainer = page.locator('[data-clip-container]').first();
      await expect(clipContainer).toBeVisible();

      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await clipContainer.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });

      const clickX = box!.x + box!.width / 2;
      const clickY = box!.y + box!.height / 2;
      await page.mouse.click(clickX, clickY);

      // The playhead must land at the click x. Before the fix the Tone
      // adapter's lookAhead (0.1s) + outputLatency pulled it ~4.3-4.7px
      // (at this example's 1024 spp) behind the click.
      const playhead = page.locator('[data-playhead]');
      await expect(playhead).toBeVisible();
      await expect(async () => {
        const phBox = await playhead.boundingBox();
        expect(phBox).toBeTruthy();
        expect(Math.abs(phBox!.x + phBox!.width / 2 - clickX)).toBeLessThanOrEqual(2);
      }).toPass({ timeout: 5000 });
    });
  });

  test.describe('Clip Boundaries', () => {
    test('clip boundaries exist and have correct dimensions', async ({ page }) => {
      // Check that boundary elements exist — use retrying assertion
      // since clips may still be rendering after playlist is "ready"
      const leftBoundaries = page.locator('[data-boundary-edge="left"]');
      const rightBoundaries = page.locator('[data-boundary-edge="right"]');

      await expect(leftBoundaries.first()).toBeVisible();
      await expect(async () => {
        const leftCount = await leftBoundaries.count();
        const rightCount = await rightBoundaries.count();
        expect(leftCount).toBeGreaterThan(0);
        expect(rightCount).toBeGreaterThan(0);
        expect(leftCount).toBe(rightCount); // Each clip has both boundaries
      }).toPass({ timeout: 5000 });
    });

    test('clip boundaries are clickable (not blocked by other elements)', async ({ page }) => {
      // Get the first left boundary
      const boundary = page.locator('[data-boundary-edge="left"]').first();
      await expect(boundary).toBeVisible();

      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await boundary.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });

      // Use elementFromPoint to verify the boundary is the topmost element
      const isClickable = await page.evaluate(
        ({ x, y }) => {
          const element = document.elementFromPoint(x, y);
          return element?.getAttribute('data-boundary-edge') === 'left';
        },
        { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
      );

      expect(isClickable).toBe(true);
    });

    test('boundary shows col-resize cursor on hover', async ({ page }) => {
      const boundary = page.locator('[data-boundary-edge="left"]').first();
      await expect(boundary).toBeVisible();

      await expect(async () => {
        const cursor = await boundary.evaluate((el) => {
          return window.getComputedStyle(el).cursor;
        });
        expect(cursor).toBe('col-resize');
      }).toPass({ timeout: 5000 });
    });

    test('boundary has pointer-events: auto', async ({ page }) => {
      const boundary = page.locator('[data-boundary-edge="left"]').first();
      await expect(boundary).toBeVisible();

      await expect(async () => {
        const pointerEvents = await boundary.evaluate((el) => {
          return window.getComputedStyle(el).pointerEvents;
        });
        expect(pointerEvents).toBe('auto');
      }).toPass({ timeout: 5000 });
    });
  });

  test.describe('Clip Headers', () => {
    test('clip headers exist and show track names', async ({ page }) => {
      // Check for clip headers with track names (they're divs with data-clip-id)
      const kickHeader = page.locator('[data-clip-id]:has-text("Kick")').first();
      await expect(kickHeader).toBeVisible();

      const hihatHeader = page.locator('[data-clip-id]:has-text("HiHat")').first();
      await expect(hihatHeader).toBeVisible();
    });

    test('clip headers are draggable (have dnd-kit attributes)', async ({ page }) => {
      const header = page.locator('[data-clip-id]').first();
      await expect(header).toBeVisible();

      // Check for dnd-kit draggable attributes — use retrying assertion
      // since dnd-kit may attach attributes after initial render
      await expect(async () => {
        const roleDescription = await header.getAttribute('aria-roledescription');
        expect(roleDescription).toBe('draggable');
      }).toPass({ timeout: 5000 });
    });

    test('clip headers have pointer-events: auto', async ({ page }) => {
      // Find the header container (the styled div with data-clip-id)
      const headerContainer = page.locator('[data-clip-id]').first();
      await expect(headerContainer).toBeVisible();

      await expect(async () => {
        const pointerEvents = await headerContainer.evaluate((el) => {
          return window.getComputedStyle(el).pointerEvents;
        });
        expect(pointerEvents).toBe('auto');
      }).toPass({ timeout: 5000 });
    });

    test('clip headers show grab cursor', async ({ page }) => {
      const headerContainer = page.locator('[data-clip-id]').first();
      await expect(headerContainer).toBeVisible();

      await expect(async () => {
        const cursor = await headerContainer.evaluate((el) => {
          return window.getComputedStyle(el).cursor;
        });
        expect(cursor).toBe('grab');
      }).toPass({ timeout: 5000 });
    });
  });

  test.describe('Clip Container', () => {
    test('clip container has pointer-events: none (allows click-through)', async ({ page }) => {
      const clipContainer = page.locator('[data-clip-container]').first();
      await expect(clipContainer).toBeVisible();

      // Retrying assertion: a one-shot getComputedStyle can read '' while
      // the clip is being re-rendered (styles not applied yet).
      await expect(clipContainer).toHaveCSS('pointer-events', 'none');
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('pressing Space toggles play/pause', async ({ page }) => {
      // Verify we start in stopped state (Play button should be visible)
      const playButton = page.getByRole('button', { name: 'Play' });
      await expect(playButton).toBeVisible();

      // Use Play button for reliable AudioContext init
      await playButton.click();

      // Wait for time to advance (tolerates AudioContext init delay)
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      await expect(async () => {
        const time = await timeDisplay.textContent();
        expect(time).not.toBe('00:00:00.000');
      }).toPass({ timeout: 10000 });

      // Press Space to pause (tests keyboard shortcut after audio is initialized)
      await page.keyboard.press('Space');

      // Capture time after pause
      const timeAfterPause = await timeDisplay.textContent();

      // Wait and check time hasn't changed (we're paused)
      await page.waitForTimeout(200);
      const timeAfterWait = await timeDisplay.textContent();

      expect(timeAfterPause).toBe(timeAfterWait);
    });

    test('pressing Escape stops playback and resets to start position', async ({ page }) => {
      // Click somewhere to set a non-zero position
      const tracksContainer = page.locator('[data-scroll-container]');
      await expect(tracksContainer).toBeVisible();

      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await tracksContainer.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });
      await page.mouse.click(box!.x + box!.width / 3, box!.y + box!.height / 2);

      // Start playback via button for reliable AudioContext init
      await page.getByRole('button', { name: 'Play' }).click();

      // Wait for playback to start
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      await expect(async () => {
        const time = await timeDisplay.textContent();
        expect(time).not.toBe('00:00:00.000');
      }).toPass({ timeout: 10000 });

      // Press Escape to stop
      await page.keyboard.press('Escape');

      // Time should reset to the start position (where we clicked, not 00:00:00.000)
      // Just verify playback stopped - the exact behavior depends on implementation
      const timeAfterStop = await timeDisplay.textContent();

      // Wait and verify time isn't advancing
      await page.waitForTimeout(200);
      const timeAfterWait = await timeDisplay.textContent();

      expect(timeAfterStop).toBe(timeAfterWait);
    });

    test('pressing 0 rewinds to start', async ({ page }) => {
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);

      // Use Play button for reliable AudioContext init + playback start
      await page.getByRole('button', { name: 'Play' }).click();

      // Wait for time to advance (tolerates AudioContext init delay)
      await expect(async () => {
        const time = await timeDisplay.textContent();
        expect(time).not.toBe('00:00:00.000');
      }).toPass({ timeout: 10000 });

      // Pause playback
      await page.getByRole('button', { name: 'Pause' }).click();

      // Press 0 to rewind
      await page.keyboard.press('0');

      // Time should be at start
      await expect(timeDisplay).toHaveText('00:00:00.000');
    });

    test('pressing S splits clip at playhead on selected track', async ({ page }) => {
      // First, click on a clip to select its track
      const clipHeader = page.locator('[data-clip-id]:has-text("Kick")').first();
      await clipHeader.click();

      // Count clips before split
      const clipsBefore = await page.locator('[data-clip-container]').count();

      // Click on the waveform to position playhead within the clip
      const clipContainer = page.locator('[data-clip-container]').first();
      await expect(clipContainer).toBeVisible();

      let clipBox: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        clipBox = await clipContainer.boundingBox();
        expect(clipBox).toBeTruthy();
      }).toPass({ timeout: 5000 });

      // Click in the middle of the clip
      await page.mouse.click(clipBox!.x + clipBox!.width / 2, clipBox!.y + clipBox!.height / 2);

      // Press S to split
      await page.keyboard.press('s');

      // Wait for React to update
      await page.waitForTimeout(100);

      // Count clips after split - should have one more
      const clipsAfter = await page.locator('[data-clip-container]').count();
      expect(clipsAfter).toBe(clipsBefore + 1);
    });
  });

  test.describe('Split During Playback', () => {
    test('splitting a clip during playback continues playing', async ({ page }) => {
      // Click on a clip to select its track
      const clipHeader = page.locator('[data-clip-id]:has-text("Bass")').first();
      await clipHeader.click();

      // Position playhead within the Bass clip (it spans most of the timeline)
      const tracksContainer = page.locator('[data-scroll-container]');
      await expect(tracksContainer).toBeVisible();

      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await tracksContainer.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });
      await page.mouse.click(box!.x + 100, box!.y + box!.height / 2);

      // Start playback via button for reliable AudioContext init
      await page.getByRole('button', { name: 'Play' }).click();

      // Wait for playback to start
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      await expect(async () => {
        const time = await timeDisplay.textContent();
        expect(time).not.toBe('00:00:00.000');
      }).toPass({ timeout: 10000 });

      const timeBeforeSplit = await timeDisplay.textContent();

      // Split the clip while playing
      await page.keyboard.press('s');

      // Wait a moment for the split and playback resume
      await page.waitForTimeout(300);

      // Time should have continued advancing (playback resumed)
      const timeAfterSplit = await timeDisplay.textContent();
      expect(timeAfterSplit).not.toBe(timeBeforeSplit);

      // Stop playback
      await page.keyboard.press('Escape');
    });
  });

  test.describe('Selection', () => {
    // #733: the drag anchor is where the pointer went down. A leftward drag
    // used to keep only the last pointer movement.
    for (const direction of [1, -1]) {
      test(`dragging ${direction > 0 ? 'right' : 'left'} selects the dragged range`, async ({
        page,
      }) => {
        const row = page.locator('[data-track-row]').first();
        await expect(row).toBeVisible();
        let box: { x: number; y: number; width: number; height: number } | null = null;
        await expect(async () => {
          box = await row.boundingBox();
          expect(box).toBeTruthy();
        }).toPass({ timeout: 5000 });

        // Below the clip header, away from clip boundaries.
        const y = box!.y + box!.height - 10;
        const anchorX = box!.x + 500;
        const dragPx = 200;

        await page.mouse.move(anchorX, y);
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) {
          await page.mouse.move(anchorX + direction * i * (dragPx / 10), y);
        }

        const selection = page.locator('[data-selection]');
        const expectedLeft = direction > 0 ? anchorX : anchorX - dragPx;
        const expectDraggedRange = async () => {
          await expect(async () => {
            const selectionBox = await selection.boundingBox();
            expect(selectionBox).toBeTruthy();
            expect(Math.abs(selectionBox!.width - dragPx)).toBeLessThanOrEqual(2);
            expect(Math.abs(selectionBox!.x - expectedLeft)).toBeLessThanOrEqual(2);
          }).toPass({ timeout: 5000 });
        };

        // While the button is still down, and again after release.
        await expectDraggedRange();
        await page.mouse.up();
        await expectDraggedRange();
      });
    }

    // The drag is followed on the window: the pointer may leave the tracks and
    // the button may be released anywhere.
    test('a drag keeps following the pointer outside the tracks', async ({ page }) => {
      const row = page.locator('[data-track-row]').first();
      await expect(row).toBeVisible();
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await row.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });

      const y = box!.y + box!.height - 10;
      const anchorX = box!.x + 300;
      const selection = page.locator('[data-selection]').first();
      const expectSelection = async (left: number, width: number) => {
        await expect(async () => {
          const selectionBox = await selection.boundingBox();
          expect(selectionBox).toBeTruthy();
          expect(Math.abs(selectionBox!.x - left)).toBeLessThanOrEqual(2);
          expect(Math.abs(selectionBox!.width - width)).toBeLessThanOrEqual(2);
        }).toPass({ timeout: 5000 });
      };
      const heading = await page.locator('h1').first().boundingBox();
      expect(heading).toBeTruthy();
      const outsideY = heading!.y + heading!.height / 2;

      await page.mouse.move(anchorX, y);
      await page.mouse.down();
      await page.mouse.move(anchorX + 40, y, { steps: 4 });
      // Leave upwards, then keep dragging right while outside.
      await page.mouse.move(anchorX + 40, outsideY, { steps: 5 });
      await page.mouse.move(anchorX + 200, outsideY, { steps: 8 });
      await expectSelection(anchorX, 200);

      // Released outside: the range is kept and the drag is over.
      await page.mouse.up();
      await expectSelection(anchorX, 200);
      for (let i = 0; i <= 5; i++) {
        await page.mouse.move(anchorX + 300 + i * 20, y);
      }
      await page.waitForTimeout(200);
      await expectSelection(anchorX, 200);

      // Dragging over the page did not select its text.
      expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
    });

    test('a drag past the left edge of the tracks selects from the start', async ({ page }) => {
      const row = page.locator('[data-track-row]').first();
      await expect(row).toBeVisible();
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await row.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });

      const y = box!.y + box!.height - 10;
      const anchorX = box!.x + 300;
      const selection = page.locator('[data-selection]').first();
      const expectSelection = async (left: number, width: number) => {
        await expect(async () => {
          const selectionBox = await selection.boundingBox();
          expect(selectionBox).toBeTruthy();
          expect(Math.abs(selectionBox!.x - left)).toBeLessThanOrEqual(2);
          expect(Math.abs(selectionBox!.width - width)).toBeLessThanOrEqual(2);
        }).toPass({ timeout: 5000 });
      };
      const heading = await page.locator('h1').first().boundingBox();
      expect(heading).toBeTruthy();
      const outsideY = heading!.y + heading!.height / 2;

      await page.mouse.move(anchorX, y);
      await page.mouse.down();
      // One jump from inside to well left of the tracks, as a fast drag does.
      await page.mouse.move(Math.max(box!.x - 150, 1), outsideY);
      await expectSelection(box!.x, 300);
      await page.mouse.up();
      await expectSelection(box!.x, 300);
    });

    test('the secondary mouse button does not start a selection', async ({ page }) => {
      const row = page.locator('[data-track-row]').first();
      await expect(row).toBeVisible();
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await row.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });
      const y = box!.y + box!.height - 10;

      await page.mouse.move(box!.x + 300, y);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(box!.x + 500, y, { steps: 5 });
      await page.mouse.up({ button: 'right' });
      // Moves afterwards, no button held.
      await page.mouse.move(box!.x + 600, y, { steps: 5 });
      await page.waitForTimeout(200);

      await expect(page.locator('[data-selection]')).toHaveCount(0);
    });

    test('clip z-index is lower than playhead z-index', async ({ page }) => {
      // Selection should render above clips but below playhead
      // We verify clips have lower z-index than playhead as a proxy for correct layering
      const clipContainer = page.locator('[data-clip-container]').first();
      const playhead = page.locator('[data-playhead]');
      await expect(clipContainer).toBeVisible();
      await expect(playhead).toBeVisible();

      const clipZIndex = await clipContainer.evaluate((el) => {
        return window.getComputedStyle(el).zIndex;
      });
      const playheadZIndex = await playhead.evaluate((el) => {
        return window.getComputedStyle(el).zIndex;
      });

      const clipZ = parseInt(clipZIndex) || 0;
      const playheadZ = parseInt(playheadZIndex) || 0;

      // Clips should have lower z-index than playhead (and by extension, selection)
      expect(clipZ).toBeLessThan(playheadZ);
    });
  });

  test.describe('Drag Interactions', () => {
    test('dragging clip header moves the clip', async ({ page }) => {
      // Get the first clip header (use data-clip-id selector)
      const header = page.locator('[data-clip-id]').first();
      await expect(header).toBeVisible();

      let headerBox: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        headerBox = await header.boundingBox();
        expect(headerBox).toBeTruthy();
      }).toPass({ timeout: 5000 });

      // Get initial clip position
      const clipContainer = page.locator('[data-clip-container]').first();
      const initialLeft = await clipContainer.evaluate((el) => {
        return el.style.left || window.getComputedStyle(el).left;
      });

      // Drag the header to the right
      await page.mouse.move(
        headerBox!.x + headerBox!.width / 2,
        headerBox!.y + headerBox!.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        headerBox!.x + headerBox!.width / 2 + 100,
        headerBox!.y + headerBox!.height / 2,
        { steps: 10 }
      );
      await page.mouse.up();

      // Check that position changed (clip moved) — use retrying assertion
      await expect(async () => {
        const finalLeft = await clipContainer.evaluate((el) => {
          return el.style.left || window.getComputedStyle(el).left;
        });
        expect(finalLeft).not.toBe(initialLeft);
      }).toPass({ timeout: 5000 });
    });

    test('dragging boundary trims the clip', async ({ page }) => {
      // Get the first right boundary (easier to test trimming from the end)
      const boundary = page.locator('[data-boundary-edge="right"]').first();
      await expect(boundary).toBeVisible();

      let boundaryBox: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        boundaryBox = await boundary.boundingBox();
        expect(boundaryBox).toBeTruthy();
      }).toPass({ timeout: 5000 });

      // Get initial clip width
      const clipContainer = page.locator('[data-clip-container]').first();
      const initialWidth = await clipContainer.evaluate((el) => {
        return el.style.width || window.getComputedStyle(el).width;
      });

      // Drag the boundary to the left (trim shorter)
      await page.mouse.move(
        boundaryBox!.x + boundaryBox!.width / 2,
        boundaryBox!.y + boundaryBox!.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(boundaryBox!.x - 50, boundaryBox!.y + boundaryBox!.height / 2, {
        steps: 10,
      });
      await page.mouse.up();

      // Check that width changed (clip trimmed) — use retrying assertion
      await expect(async () => {
        const finalWidth = await clipContainer.evaluate((el) => {
          return el.style.width || window.getComputedStyle(el).width;
        });
        const initialPx = parseInt(initialWidth);
        const finalPx = parseInt(finalWidth);
        expect(finalPx).toBeLessThan(initialPx);
      }).toPass({ timeout: 5000 });
    });
  });
});
