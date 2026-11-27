import { test, expect, type Page } from '@playwright/test';

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
      // Audio clips are never drawn as piano rolls.
      expect(await page.locator('[data-piano-roll]').count()).toBe(0);
    }).toPass({ timeout: 10000 });
  });

  // #828: a zoom keeps the time under the pointer where it is when the
  // pointer is over the tracks, and the time at the centre of the view
  // otherwise. A click on a zoom button puts the pointer on the button.
  // (Zoom In is disabled after two clicks on this page: the last zoom level.)
  test('a zoom button keeps the time at the centre of the view where it is', async ({ page }) => {
    const zoomIn = page.getByRole('button', { name: 'Zoom In' });
    await zoomIn.click();
    await zoomIn.click();
    // The last zoom level: the width read below is the final one.
    await expect(zoomIn).toBeDisabled();
    const container = page.locator('[data-scroll-container]').first();
    // Scroll to the middle of the timeline.
    await expect(async () => {
      const scrolled = await container.evaluate((el) => {
        el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
        return el.scrollLeft;
      });
      expect(scrolled).toBeGreaterThan(100);
    }).toPass({ timeout: 5000 });
    const centreShare = () =>
      container.evaluate((el) => (el.scrollLeft + el.clientWidth / 2) / el.scrollWidth);
    const before = await centreShare();
    const widthBefore = await container.evaluate((el) => el.scrollWidth);
    await page.getByRole('button', { name: 'Zoom Out' }).click();
    await expect(async () => {
      expect(await container.evaluate((el) => el.scrollWidth)).toBeLessThan(widthBefore * 0.75);
      expect(Math.abs((await centreShare()) - before)).toBeLessThan(0.005);
    }).toPass({ timeout: 5000 });
  });

  // #828: without a pointer over the timeline, a selected range on screen is
  // the anchor (before the cursor and the centre). The range is near the left
  // of the view, so keeping the centre would move it about 120 px.
  test('a zoom button keeps a selected range where it is on screen', async ({ page }) => {
    const zoomIn = page.getByRole('button', { name: 'Zoom In' });
    await zoomIn.click();
    await zoomIn.click();
    // The last zoom level: the width read below is the final one.
    await expect(zoomIn).toBeDisabled();
    const container = page.locator('[data-scroll-container]').first();
    await expect(async () => {
      const scrolled = await container.evaluate((el) => {
        el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
        return el.scrollLeft;
      });
      expect(scrolled).toBeGreaterThan(100);
    }).toPass({ timeout: 5000 });
    const row = page.locator('[data-track-row]').first();
    await row.scrollIntoViewIfNeeded();
    let frame: { x: number; y: number; width: number; height: number } | null = null;
    let rowBox: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      frame = await container.boundingBox();
      rowBox = await row.boundingBox();
      expect(frame).toBeTruthy();
      expect(rowBox).toBeTruthy();
    }).toPass({ timeout: 5000 });
    const y = rowBox!.y + rowBox!.height - 10;
    const startX = frame!.x + 150;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX + 120, y, { steps: 6 });
    await page.mouse.up();

    const selection = page.locator('[data-selection]').first();
    const centreX = async () => {
      const box = await selection.boundingBox();
      expect(box).toBeTruthy();
      return box!.x + box!.width / 2;
    };
    let before = 0;
    await expect(async () => {
      before = await centreX();
      expect(Math.abs(before - (startX + 60))).toBeLessThanOrEqual(3);
    }).toPass({ timeout: 5000 });

    await page.getByRole('button', { name: 'Zoom Out' }).click();
    await expect(async () => {
      const box = await selection.boundingBox();
      expect(box!.width).toBeLessThan(80);
      expect(Math.abs((await centreX()) - before)).toBeLessThanOrEqual(2);
    }).toPass({ timeout: 5000 });
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

    // The page has no undo control; undo and redo are the keyboard shortcuts of
    // <KeyboardShortcuts undo />, so the tests observe them through clip geometry.
    const clipWidths = (page: import('@playwright/test').Page) =>
      page
        .locator('[data-clip-container]')
        .evaluateAll((els) =>
          els.map((el) => Math.round((el as HTMLElement).getBoundingClientRect().width * 10) / 10)
        );

    // Clips are added as tracks load: read the widths once two reads 300 ms apart agree.
    const settledWidths = async (page: import('@playwright/test').Page) => {
      let widths: number[] = [];
      await expect(async () => {
        const first = await clipWidths(page);
        await page.waitForTimeout(300);
        widths = await clipWidths(page);
        expect(widths.length).toBeGreaterThan(0);
        expect(widths).toEqual(first);
      }).toPass({ timeout: 10000 });
      return widths;
    };

    const pressRightHandle = async (page: import('@playwright/test').Page) => {
      const container = page.locator('[data-clip-container]').first();
      const handle = container.locator('[data-boundary-edge="right"]');
      await expect(handle).toBeVisible();
      await handle.scrollIntoViewIfNeeded();
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await handle.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });
      const x = box!.x + box!.width / 2;
      const y = box!.y + box!.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      return { container, x, y };
    };

    const dragLeft = async (page: import('@playwright/test').Page, x: number, y: number) => {
      for (const dx of [10, 20, 30, 45, 60]) {
        await page.mouse.move(x - dx, y, { steps: 3 });
      }
    };

    test('Escape during a trim leaves the clip where it was', async ({ page }) => {
      const original = await settledWidths(page);
      const { container, x, y } = await pressRightHandle(page);
      const originalWidth = original[0];

      await dragLeft(page, x, y);
      // The preview is visible while the button is still down.
      await expect(async () => {
        const widths = await clipWidths(page);
        expect(widths[0]).toBeLessThan(originalWidth - 20);
      }).toPass({ timeout: 5000 });

      // Focus is on the document body area / the pressed handle (mouse held).
      await page.keyboard.press('Escape');
      await expect(async () => {
        expect(await clipWidths(page)).toEqual(original);
      }).toPass({ timeout: 5000 });

      await page.mouse.up();
      await page.waitForTimeout(500);
      expect(await clipWidths(page)).toEqual(original);
      await expect(container).toBeVisible();

      // No undo step was made: undo changes no clip geometry.
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(500);
      expect(await clipWidths(page)).toEqual(original);
    });

    test('a trim is one undo step', async ({ page }) => {
      const original = await settledWidths(page);
      const { x, y } = await pressRightHandle(page);
      await dragLeft(page, x, y);
      await page.mouse.up();

      let trimmed: number[] = [];
      await expect(async () => {
        trimmed = await clipWidths(page);
        expect(trimmed[0]).toBeLessThan(original[0] - 20);
      }).toPass({ timeout: 5000 });
      // Only the dragged clip changed.
      await expect(async () => {
        expect(await clipWidths(page)).toEqual([trimmed[0], ...original.slice(1)]);
      }).toPass({ timeout: 5000 });

      await page.keyboard.press('Control+z');
      await expect(async () => {
        expect(await clipWidths(page)).toEqual(original);
      }).toPass({ timeout: 5000 });

      // A second undo has nothing left to undo.
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(500);
      expect(await clipWidths(page)).toEqual(original);

      await page.keyboard.press('Control+Shift+z');
      await expect(async () => {
        expect(await clipWidths(page)).toEqual(trimmed);
      }).toPass({ timeout: 5000 });
    });
  });

  // Until 2026-11 a press during playback moved playback at once (and again on
  // the release), and no range could be drawn while playing. Nothing is
  // committed before the release now; what the release does depends on the
  // automatic scroll, which this page starts with switched on.
  test.describe('Pressing and dragging on the tracks during playback', () => {
    const seconds = (text: string | null) => {
      const match = /(\d+):(\d+):(\d+\.\d+)/.exec(text ?? '');
      return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : NaN;
    };

    async function startPlayback(page: import('@playwright/test').Page, automaticScroll: boolean) {
      const checkbox = page.getByRole('checkbox', { name: /automatic scroll/i });
      if ((await checkbox.isChecked()) !== automaticScroll) await checkbox.click();
      const readout = page.getByLabel('Audio position');
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await expect(async () => {
        expect(seconds(await readout.textContent())).toBeGreaterThan(0.2);
      }).toPass({ timeout: 10000 });
      // Measured after Play was clicked: clicking it may scroll the page.
      const row = page.locator('[data-track-row]').nth(1);
      await expect(row).toBeVisible();
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await row.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });
      const now = async () => seconds(await readout.textContent());
      // Below the clip header, away from clip boundaries.
      return { now, y: box!.y + box!.height - 10, left: box!.x };
    }

    test('automatic scroll off: a drag draws a range without disturbing playback, and the release plays it to its end', async ({
      page,
    }) => {
      const { now, y, left } = await startPlayback(page, false);
      const selection = page.locator('[data-selection]');
      const play = page.getByRole('button', { name: 'Play', exact: true });

      // 300 px is 6.4 s on this page; playback is in its first seconds.
      await page.mouse.move(left + 300, y);
      await page.mouse.down();
      await page.waitForTimeout(400);
      expect(await now()).toBeLessThan(4);
      await expect(selection).toHaveCount(0);

      await page.mouse.move(left + 380, y, { steps: 4 });
      await page.mouse.move(left + 450, y, { steps: 4 });
      await expect(async () => {
        const selectionBox = await selection.boundingBox();
        expect(selectionBox).toBeTruthy();
        expect(Math.abs(selectionBox!.width - 150)).toBeLessThanOrEqual(2);
        expect(Math.abs(selectionBox!.x - (left + 300))).toBeLessThanOrEqual(2);
      }).toPass({ timeout: 5000 });
      // Still the old play: the range is only drawn.
      expect(await now()).toBeLessThan(4);

      await page.mouse.up();
      // The range (6.4 s to 9.6 s: long enough to be seen playing) is played
      // from its start...
      await expect(async () => {
        const time = await now();
        expect(time).toBeGreaterThanOrEqual(6.3);
        expect(time).toBeLessThan(9.7);
      }).toPass({ timeout: 3000 });
      await expect(selection).toHaveCount(1);
      // It is playing, not resting at the range's start: the position moves on.
      await expect(async () => {
        expect(await now()).toBeGreaterThan(6.9);
      }).toPass({ timeout: 3000 });
      // ...and playback stops at its end, the cursor back at its start.
      await expect(play).toBeEnabled({ timeout: 8000 });
      await expect(async () => {
        expect(Math.abs((await now()) - 6.4)).toBeLessThan(0.1);
      }).toPass({ timeout: 3000 });
    });

    test('automatic scroll off: a click moves playback there on the release', async ({ page }) => {
      const { now, y, left } = await startPlayback(page, false);

      await page.mouse.move(left + 300, y);
      await page.mouse.down();
      await page.waitForTimeout(700);
      // Held: playback has not moved to 6.4 s.
      expect(await now()).toBeLessThan(4);
      await page.mouse.up();

      await expect(async () => {
        expect(await now()).toBeGreaterThanOrEqual(6.3);
      }).toPass({ timeout: 3000 });
      await expect(page.locator('[data-selection]')).toHaveCount(0);
      // It carries on from there.
      await page.waitForTimeout(800);
      expect(await now()).toBeGreaterThan(7);
      await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    });

    test('automatic scroll on: no range is drawn, and the release seeks once to where the press landed', async ({
      page,
    }) => {
      const { now, y, left } = await startPlayback(page, true);
      const selection = page.locator('[data-selection]');

      await page.mouse.move(left + 300, y);
      await page.mouse.down();
      await page.mouse.move(left + 380, y, { steps: 6 });
      await page.waitForTimeout(400);
      await expect(selection).toHaveCount(0);
      expect(await now()).toBeLessThan(4);

      await page.mouse.up();
      await expect(async () => {
        const time = await now();
        expect(time).toBeGreaterThanOrEqual(6.3);
        // The press (6.4 s), not the release (8.1 s).
        expect(time).toBeLessThan(7.8);
      }).toPass({ timeout: 2000 });
      await expect(selection).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    });
    // The reason for the rule: with automatic scroll on the view scrolls to
    // follow the playhead, so the audio moves under a pointer that is held
    // still. Zoomed in, this page scrolls within a few seconds.
    test('automatic scroll on, while the view is scrolling: the release seeks to the audio that was pressed, not to what is under the pointer by then', async ({
      page,
    }) => {
      await page.getByRole('button', { name: 'Zoom In' }).click();
      await page.getByRole('button', { name: 'Zoom In' }).click();
      const { y } = await startPlayback(page, true);
      const container = page.locator('[data-scroll-container]').first();
      const playhead = container.locator('[data-playhead]');
      const scrollLeft = () => container.evaluate((el) => el.scrollLeft);
      const playheadX = () =>
        playhead.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);

      // Wait until the view follows the playhead.
      await expect(async () => {
        expect(await scrollLeft()).toBeGreaterThan(60);
      }).toPass({ timeout: 20000 });
      let frame: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        frame = await container.boundingBox();
        expect(frame).toBeTruthy();
      }).toPass({ timeout: 5000 });

      // Press ahead of the playhead and hold still while the view scrolls on.
      const pressX = frame!.x + frame!.width - 60;
      await page.mouse.move(pressX, y);
      const scrollAtPress = await scrollLeft();
      await page.mouse.down();
      const pressedContentX = scrollAtPress + (pressX - frame!.x);
      await expect(async () => {
        expect((await scrollLeft()) - scrollAtPress).toBeGreaterThan(220);
      }).toPass({ timeout: 10000 });
      const underPointerNow = (await scrollLeft()) + (pressX - frame!.x);
      expect(underPointerNow - pressedContentX).toBeGreaterThan(220);
      await page.mouse.up();

      // Playback is at the audio that was pressed (and moving on from it),
      // well short of what the pointer is over now.
      await expect(async () => {
        const x = await playheadX();
        // The few pixels below: the view scrolled between reading its
        // position and the press. The bound above is 0.6 s of playback; what
        // the pointer is over by now is more than 220 px on.
        expect(x).toBeGreaterThanOrEqual(pressedContentX - 3);
        expect(x).toBeLessThan(pressedContentX + 120);
      }).toPass({ timeout: 1000 });
      await expect(page.locator('[data-selection]')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    });
  });
});

/**
 * Holds the page's audio requests (all of them, or those whose URL contains
 * one of `names`) until `release()` is called. Counts what it held, so a
 * pattern that matches nothing fails the test instead of passing it.
 */
async function holdAudio(page: Page, names: string[] = []) {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = 0;
  await page.route('**/media/audio/AlbertKader_Ubiquitous/*.opus', async (route) => {
    const url = route.request().url();
    if (names.length === 0 || names.some((name) => url.includes(name))) {
      held++;
      await released;
    }
    await route.continue().catch(() => {});
  });
  return { release: () => release(), held: () => held };
}

const PLAY_BEFORE_READY_WARNING = 'playback starts once the playlist is ready';
const BASS_AUDIO = '08_Bass.opus';
const timeDisplay = (page: Page) => page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
const ready = (page: Page) => page.locator('[data-playlist-state="ready"]');
const row = (page: Page, index: number) => page.locator('[data-track-row]').nth(index);
const KICK_ROW = 0;
const BASS_ROW = 4;

/** Waits until the clips of row `index` are loaded (no placeholder left in it). */
async function expectRowLoaded(page: Page, index: number) {
  await expect(row(page, index).locator('[data-clip-container]').first()).toBeVisible({
    timeout: 30000,
  });
  await expect(row(page, index).locator('[data-clip-placeholder="true"]')).toHaveCount(0, {
    timeout: 30000,
  });
}

/** Left and width of every clip of row `index`, rounded to 0.1 px. */
const rowClipBoxes = (page: Page, index: number) =>
  row(page, index)
    .locator('[data-clip-container]')
    .evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect();
        return { left: Math.round(box.left * 10) / 10, width: Math.round(box.width * 10) / 10 };
      })
    );

// #812: the arrangement loads each file and the playlist is ready once, when
// no file is pending. These tests hold requests to act while files load.
test.describe('Multi-Clip Example — while files are loading', () => {
  test('Play pressed while the first files are still loading does nothing, and plays after ready', async ({
    page,
    baseURL,
  }) => {
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text());
    });
    const hold = await holdAudio(page);
    await page.goto(`${baseURL}/examples/multi-clip`);
    await page.waitForSelector('h1:has-text("Multi-Clip")', { timeout: 30000 });

    const play = page.getByRole('button', { name: 'Play', exact: true });
    const stop = page.getByRole('button', { name: 'Stop', exact: true });
    await expect(play).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-clip-placeholder="true"]').first()).toBeVisible();
    await expect.poll(() => hold.held()).toBeGreaterThan(0);
    await expect(ready(page)).toHaveCount(0);

    // Two presses while loading: nothing plays, nothing is queued.
    await play.click();
    await play.click();
    await page.waitForTimeout(1000);
    await expect(stop).toBeDisabled();
    await expect(play).toBeEnabled();
    await expect(timeDisplay(page)).toHaveText('00:00:00.000');
    // One development warning for the mount, however many presses.
    expect(warnings.filter((text) => text.includes(PLAY_BEFORE_READY_WARNING))).toHaveLength(1);

    hold.release();
    await expect(ready(page)).toHaveCount(1, { timeout: 30000 });
    // The early presses did not start playback when the playlist became ready.
    await page.waitForTimeout(500);
    await expect(stop).toBeDisabled();
    await expect(timeDisplay(page)).toHaveText('00:00:00.000');

    await play.click();
    await expect(stop).toBeEnabled();
    await expect(async () => {
      expect(await timeDisplay(page).textContent()).not.toBe('00:00:00.000');
    }).toPass({ timeout: 10000 });
    await stop.click();
  });

  test('undo after an arrival keeps the arrived clip', async ({ page, baseURL }) => {
    const hold = await holdAudio(page, [BASS_AUDIO]);
    await page.goto(`${baseURL}/examples/multi-clip`);
    await expectRowLoaded(page, KICK_ROW);
    await expect.poll(() => hold.held()).toBe(1);
    await expect(row(page, BASS_ROW).locator('[data-clip-placeholder="true"]')).toHaveCount(1);

    // Move the first Kick clip while the Bass file is still loading.
    const before = await rowClipBoxes(page, KICK_ROW);
    const header = row(page, KICK_ROW).locator('[data-clip-id]').first();
    await expect(header).toBeVisible();
    let box: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      box = await header.boundingBox();
      expect(box).toBeTruthy();
    }).toPass({ timeout: 5000 });
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2, { steps: 10 });
    await page.mouse.up();
    let moved: { left: number; width: number }[] = [];
    // Read once the drop has settled: two reads 300 ms apart agree (during the
    // drop the dragged element can be in the row twice).
    await expect(async () => {
      const first = await rowClipBoxes(page, KICK_ROW);
      await page.waitForTimeout(300);
      moved = await rowClipBoxes(page, KICK_ROW);
      expect(moved).toEqual(first);
      expect(moved).toHaveLength(before.length);
      expect(moved[0].left).toBeGreaterThan(before[0].left + 30);
    }).toPass({ timeout: 5000 });

    // The Bass file arrives: its clip is loaded, and the move is still there.
    hold.release();
    await expectRowLoaded(page, BASS_ROW);
    await expect(ready(page)).toHaveCount(1, { timeout: 30000 });
    const bassLoaded = await rowClipBoxes(page, BASS_ROW);
    expect(await rowClipBoxes(page, KICK_ROW)).toEqual(moved);

    // Undo takes back the move, and only the move: the Bass clip stays loaded.
    await page.keyboard.press('Control+z');
    await expect(async () => {
      expect(await rowClipBoxes(page, KICK_ROW)).toEqual(before);
    }).toPass({ timeout: 5000 });
    await page.waitForTimeout(500);
    await expect(row(page, BASS_ROW).locator('[data-clip-placeholder="true"]')).toHaveCount(0);
    expect(await rowClipBoxes(page, BASS_ROW)).toEqual(bassLoaded);
    expect(await rowClipBoxes(page, KICK_ROW)).toEqual(before);
  });

  for (const ending of ['release', 'Escape'] as const) {
    test(`a source that settles during a trim drag: ${
      ending === 'release' ? 'release trims' : 'Escape leaves the clip'
    }`, async ({ page, baseURL }) => {
      const hold = await holdAudio(page, [BASS_AUDIO]);
      await page.goto(`${baseURL}/examples/multi-clip`);
      await expectRowLoaded(page, KICK_ROW);
      await expect.poll(() => hold.held()).toBe(1);
      // Settled widths of the Kick row: two reads 300 ms apart agree.
      let original: { left: number; width: number }[] = [];
      await expect(async () => {
        const first = await rowClipBoxes(page, KICK_ROW);
        await page.waitForTimeout(300);
        original = await rowClipBoxes(page, KICK_ROW);
        expect(original).toEqual(first);
      }).toPass({ timeout: 10000 });

      // Press the right trim handle of the first Kick clip and drag left.
      const handle = row(page, KICK_ROW)
        .locator('[data-clip-container]')
        .first()
        .locator('[data-boundary-edge="right"]');
      await expect(handle).toBeVisible();
      await handle.scrollIntoViewIfNeeded();
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await handle.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });
      const x = box!.x + box!.width / 2;
      const y = box!.y + box!.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (const dx of [10, 20, 30, 45, 60]) {
        await page.mouse.move(x - dx, y, { steps: 3 });
      }
      let preview: { left: number; width: number }[] = [];
      await expect(async () => {
        preview = await rowClipBoxes(page, KICK_ROW);
        expect(preview[0].width).toBeLessThan(original[0].width - 20);
      }).toPass({ timeout: 5000 });

      // The Bass file arrives while the button is still down.
      hold.release();
      await expectRowLoaded(page, BASS_ROW);
      await expect(ready(page)).toHaveCount(1, { timeout: 30000 });
      // The preview is unchanged by the arrival.
      expect(await rowClipBoxes(page, KICK_ROW)).toEqual(preview);

      if (ending === 'release') {
        await page.mouse.up();
        await page.waitForTimeout(500);
        // The trim is what the preview showed.
        expect(await rowClipBoxes(page, KICK_ROW)).toEqual(preview);
      } else {
        await page.keyboard.press('Escape');
        await expect(async () => {
          expect(await rowClipBoxes(page, KICK_ROW)).toEqual(original);
        }).toPass({ timeout: 5000 });
        await page.mouse.up();
        await page.waitForTimeout(500);
        expect(await rowClipBoxes(page, KICK_ROW)).toEqual(original);
      }
      await expect(row(page, BASS_ROW).locator('[data-clip-placeholder="true"]')).toHaveCount(0);
    });
  }

  // #858: a layout change that moves the editor during a clip move leaves the
  // dragged clip behind, so the page's loading text keeps its space.
  test('the editor does not move on the page when loading ends', async ({ page, baseURL }) => {
    const hold = await holdAudio(page, [BASS_AUDIO]);
    await page.goto(`${baseURL}/examples/multi-clip`);
    const rowCount = 7;
    for (let index = 0; index < rowCount; index++) {
      if (index !== BASS_ROW) await expectRowLoaded(page, index);
    }
    await expect.poll(() => hold.held()).toBe(1);
    const playlist = page.locator('[data-playlist-state]');
    await expect(page.locator('[data-playlist-state="loading"]')).toHaveCount(1);
    const before = await playlist.boundingBox();
    expect(before).toBeTruthy();

    hold.release();
    await expect(ready(page)).toHaveCount(1, { timeout: 30000 });
    await expectRowLoaded(page, BASS_ROW);
    const after = await playlist.boundingBox();
    expect(after).toBeTruthy();
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(0.5);
  });
});
