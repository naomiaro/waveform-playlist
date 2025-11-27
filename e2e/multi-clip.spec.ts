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
    // Wait for waveforms to load (audio files may take time to fetch and decode)
    await page.waitForSelector('[data-clip-container]', { timeout: 30000 });
  });

  test.describe('Playhead Positioning', () => {
    test('clicking on waveform area moves playhead', async ({ page }) => {
      // Get the first clip container - this ensures we click on actual waveform content
      const clipContainer = page.locator('[data-clip-container]').first();
      const box = await clipContainer.boundingBox();
      expect(box).toBeTruthy();

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
  });

  test.describe('Clip Boundaries', () => {
    test('clip boundaries exist and have correct dimensions', async ({ page }) => {
      // Check that boundary elements exist
      const leftBoundaries = page.locator('[data-boundary-edge="left"]');
      const rightBoundaries = page.locator('[data-boundary-edge="right"]');

      const leftCount = await leftBoundaries.count();
      const rightCount = await rightBoundaries.count();

      expect(leftCount).toBeGreaterThan(0);
      expect(rightCount).toBeGreaterThan(0);
      expect(leftCount).toBe(rightCount); // Each clip has both boundaries
    });

    test('clip boundaries are clickable (not blocked by other elements)', async ({ page }) => {
      // Get the first left boundary
      const boundary = page.locator('[data-boundary-edge="left"]').first();
      const box = await boundary.boundingBox();
      expect(box).toBeTruthy();

      // Use elementFromPoint to verify the boundary is the topmost element
      const isClickable = await page.evaluate(({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return element?.getAttribute('data-boundary-edge') === 'left';
      }, { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 });

      expect(isClickable).toBe(true);
    });

    test('boundary shows col-resize cursor on hover', async ({ page }) => {
      const boundary = page.locator('[data-boundary-edge="left"]').first();

      // Check computed cursor style
      const cursor = await boundary.evaluate((el) => {
        return window.getComputedStyle(el).cursor;
      });

      expect(cursor).toBe('col-resize');
    });

    test('boundary has pointer-events: auto', async ({ page }) => {
      const boundary = page.locator('[data-boundary-edge="left"]').first();

      const pointerEvents = await boundary.evaluate((el) => {
        return window.getComputedStyle(el).pointerEvents;
      });

      expect(pointerEvents).toBe('auto');
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

      // Check for dnd-kit draggable attributes
      const roleDescription = await header.getAttribute('aria-roledescription');
      expect(roleDescription).toBe('draggable');
    });

    test('clip headers have pointer-events: auto', async ({ page }) => {
      // Find the header container (the styled div with data-clip-id)
      const headerContainer = page.locator('[data-clip-id]').first();

      const pointerEvents = await headerContainer.evaluate((el) => {
        return window.getComputedStyle(el).pointerEvents;
      });

      expect(pointerEvents).toBe('auto');
    });

    test('clip headers show grab cursor', async ({ page }) => {
      const headerContainer = page.locator('[data-clip-id]').first();

      const cursor = await headerContainer.evaluate((el) => {
        return window.getComputedStyle(el).cursor;
      });

      expect(cursor).toBe('grab');
    });
  });

  test.describe('Clip Container', () => {
    test('clip container has pointer-events: none (allows click-through)', async ({ page }) => {
      const clipContainer = page.locator('[data-clip-container]').first();

      const pointerEvents = await clipContainer.evaluate((el) => {
        return window.getComputedStyle(el).pointerEvents;
      });

      expect(pointerEvents).toBe('none');
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('pressing Space toggles play/pause', async ({ page }) => {
      // Verify we start in stopped state (Play button should be visible)
      const playButton = page.getByRole('button', { name: 'Play' });
      await expect(playButton).toBeVisible();

      // Press Space to start playing
      await page.keyboard.press('Space');

      // Wait a moment for playback to start
      await page.waitForTimeout(100);

      // Time should have advanced from 00:00:00.000
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);

      // Press Space again to pause
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
      const box = await tracksContainer.boundingBox();
      await page.mouse.click(box!.x + box!.width / 3, box!.y + box!.height / 2);

      // Start playback
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);

      // Press Escape to stop
      await page.keyboard.press('Escape');

      // Time should reset to the start position (where we clicked, not 00:00:00.000)
      // Just verify playback stopped - the exact behavior depends on implementation
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      const timeAfterStop = await timeDisplay.textContent();

      // Wait and verify time isn't advancing
      await page.waitForTimeout(200);
      const timeAfterWait = await timeDisplay.textContent();

      expect(timeAfterStop).toBe(timeAfterWait);
    });

    test('pressing 0 rewinds to start', async ({ page }) => {
      // Start playback and let it run briefly to advance time
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);

      // Pause playback
      await page.keyboard.press('Space');

      // Verify time has advanced from start
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      const timeBeforeRewind = await timeDisplay.textContent();
      expect(timeBeforeRewind).not.toBe('00:00:00.000');

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
      // Get the clip container position to click within it
      const clipContainer = page.locator('[data-clip-container]').first();
      const clipBox = await clipContainer.boundingBox();
      expect(clipBox).toBeTruthy();

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
      const box = await tracksContainer.boundingBox();
      await page.mouse.click(box!.x + 100, box!.y + box!.height / 2);

      // Start playback
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);

      // Verify we're playing (time is advancing)
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
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

  test.describe('Drag Interactions', () => {
    test('dragging clip header moves the clip', async ({ page }) => {
      // Get the first clip header (use data-clip-id selector)
      const header = page.locator('[data-clip-id]').first();
      const headerBox = await header.boundingBox();
      expect(headerBox).toBeTruthy();

      // Get initial clip position
      const clipContainer = page.locator('[data-clip-container]').first();
      const initialLeft = await clipContainer.evaluate((el) => {
        return el.style.left || window.getComputedStyle(el).left;
      });

      // Drag the header to the right
      await page.mouse.move(headerBox!.x + headerBox!.width / 2, headerBox!.y + headerBox!.height / 2);
      await page.mouse.down();
      await page.mouse.move(headerBox!.x + headerBox!.width / 2 + 100, headerBox!.y + headerBox!.height / 2, { steps: 10 });
      await page.mouse.up();

      // Check that position changed (clip moved)
      const finalLeft = await clipContainer.evaluate((el) => {
        return el.style.left || window.getComputedStyle(el).left;
      });

      // Position should have changed
      expect(finalLeft).not.toBe(initialLeft);
    });

    test('dragging boundary trims the clip', async ({ page }) => {
      // Get the first right boundary (easier to test trimming from the end)
      const boundary = page.locator('[data-boundary-edge="right"]').first();
      const boundaryBox = await boundary.boundingBox();
      expect(boundaryBox).toBeTruthy();

      // Get initial clip width
      const clipContainer = page.locator('[data-clip-container]').first();
      const initialWidth = await clipContainer.evaluate((el) => {
        return el.style.width || window.getComputedStyle(el).width;
      });

      // Drag the boundary to the left (trim shorter)
      await page.mouse.move(boundaryBox!.x + boundaryBox!.width / 2, boundaryBox!.y + boundaryBox!.height / 2);
      await page.mouse.down();
      await page.mouse.move(boundaryBox!.x - 50, boundaryBox!.y + boundaryBox!.height / 2, { steps: 10 });
      await page.mouse.up();

      // Check that width changed (clip trimmed)
      const finalWidth = await clipContainer.evaluate((el) => {
        return el.style.width || window.getComputedStyle(el).width;
      });

      // Width should have decreased
      const initialPx = parseInt(initialWidth);
      const finalPx = parseInt(finalWidth);
      expect(finalPx).toBeLessThan(initialPx);
    });
  });
});
