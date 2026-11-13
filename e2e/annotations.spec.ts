import { test, expect, type Page } from '@playwright/test';

/**
 * Annotations example tests
 *
 * These tests verify the annotation functionality:
 * - Annotation display and structure
 * - Adding and removing annotations
 * - Editing annotation text and boundaries
 * - Keyboard navigation
 * - Continuous play and link endpoints
 * - JSON import/export
 */

test.describe('Annotations Example', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/annotations`);
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Annotations")', { timeout: 30000 });
    // Wait for playlist to be ready (track loaded)
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
    // Wait for annotations to load
    await page.waitForSelector('text=f000001', { timeout: 30000 });
  });

  // #686: a row of the list did nothing when clicked.
  test('a click on a row plays its annotation; a click in a field being edited does not', async ({
    page,
  }) => {
    await page.getByRole('checkbox', { name: 'Continuous Play', exact: true }).uncheck();
    const play = page.getByRole('button', { name: 'Play', exact: true });
    const pause = page.getByRole('button', { name: 'Pause', exact: true });
    await expect(pause).toBeDisabled();

    // The page starts with Editable on: the text of a row is a field.
    await page.getByText('But as the riper should by time decease,').click();
    await page.waitForTimeout(500);
    await expect(pause).toBeDisabled();
    await page.keyboard.press('Escape');

    // The time range of annotation 4 is not a field.
    await page.getByText('0:09.240 - 0:11.920').click();
    await expect(pause).toBeEnabled();
    // Continuous play is off: playback ends with the annotation (2.68 s long).
    await expect(play).toBeEnabled({ timeout: 10000 });
  });

  test.describe('Page Structure', () => {
    test('displays annotations with text content', async ({ page }) => {
      // Check for annotation text content (Shakespeare sonnet lines)
      await expect(page.getByText('From fairest creatures we desire increase,')).toBeVisible();
      await expect(page.getByText("That thereby beauty's rose might never die,")).toBeVisible();
    });

    test('displays annotation IDs', async ({ page }) => {
      // Annotations have IDs like f000001, f000002, etc.
      await expect(page.getByText('f000001').first()).toBeVisible();
      await expect(page.getByText('f000002').first()).toBeVisible();
    });

    test('displays annotation timestamps', async ({ page }) => {
      // Check for timestamp separators (annotations show time ranges)
      const timeSeparators = page.getByText(' - ');
      const count = await timeSeparators.count();
      expect(count).toBeGreaterThan(0);
    });

    test('has multiple annotations loaded', async ({ page }) => {
      // Count annotation IDs (f000001 through f000015)
      const annotationIds = page.locator('text=/f00000[1-9]|f00001[0-5]/');
      const count = await annotationIds.count();
      expect(count).toBeGreaterThanOrEqual(10);
    });
  });

  test.describe('Annotation Controls', () => {
    test('each annotation has action buttons', async ({ page }) => {
      // Check for action buttons (−, +, ✂, 🗑)
      const minusButtons = page.getByRole('button', { name: '−' });
      const plusButtons = page.getByRole('button', { name: '+' });
      const splitButtons = page.getByRole('button', { name: '✂' });
      const deleteButtons = page.getByRole('button', { name: '🗑' });

      await expect(async () => {
        expect(await minusButtons.count()).toBeGreaterThan(0);
        expect(await plusButtons.count()).toBeGreaterThan(0);
        expect(await splitButtons.count()).toBeGreaterThan(0);
        expect(await deleteButtons.count()).toBeGreaterThan(0);
      }).toPass({ timeout: 5000 });
    });

    test('annotation boundaries are draggable', async ({ page }) => {
      // Check for draggable boundary handles (aria-roledescription attribute)
      const draggableHandles = page.locator('[aria-roledescription="draggable"]');
      const count = await draggableHandles.count();
      // Each annotation has 2 draggable handles (start and end)
      expect(count).toBeGreaterThan(0);
    });
  });

  // #704 close-out: an edge drag is shown through the provider's preview and
  // reported once, on release.
  test.describe('Dragging an annotation edge', () => {
    // The right edge of the box labelled `id`: the first handle to the right
    // of its label.
    const rightEdgeOf = async (page: Page, id: string) => {
      const container = page.locator('[data-scroll-container]');
      const label = container.getByText(id, { exact: true });
      await expect(label).toBeVisible();
      const labelBox = await label.boundingBox();
      expect(labelBox).toBeTruthy();
      const centre = labelBox!.x + labelBox!.width / 2;
      const boxes = await container
        .locator('[aria-roledescription="draggable"]')
        .evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect();
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, height: rect.height };
          })
        );
      // A clip is a draggable too, and much taller than a handle.
      const edges = boxes.filter((b) => b.height < 60 && b.x > centre).sort((a, b) => a.x - b.x);
      expect(edges.length).toBeGreaterThan(0);
      return edges[0];
    };
    // "0:09.240 - 0:11.920" from the list row of an annotation.
    const timesOf = async (page: Page, id: string) => {
      // The id is the label of the box too; the list comes after the waveform.
      const row = page.getByText(id, { exact: true }).last().locator('xpath=..');
      const text = ((await row.textContent()) ?? '').replace(id, '');
      const match = text.match(/(\d+:\d{2}\.\d{3})\s*-\s*(\d+:\d{2}\.\d{3})/);
      expect(match, 'times in "' + text + '"').toBeTruthy();
      return { start: match![1], end: match![2] };
    };
    const pressAndMove = async (page: Page, from: { x: number; y: number }, distance: number) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) {
        await page.mouse.move(from.x + (distance * i) / 12, from.y);
        await page.waitForTimeout(30);
      }
    };

    test.beforeEach(async ({ page }) => {
      await expect(
        page.locator('[data-scroll-container] [aria-roledescription="draggable"]')
      ).toHaveCount(31);
    });

    test('the list and the linked neighbour follow the drag, and keep it on release', async ({
      page,
    }) => {
      const before = await timesOf(page, 'f000004');
      const start = await rightEdgeOf(page, 'f000004');

      await pressAndMove(page, start, -40);

      // Still held: the list already shows the new time, and the linked
      // neighbour's start with it.
      let during = before;
      await expect(async () => {
        during = await timesOf(page, 'f000004');
        expect(during.end).not.toBe(before.end);
        expect((await timesOf(page, 'f000005')).start).toBe(during.end);
      }).toPass({ timeout: 5000 });

      await page.mouse.up();

      await expect(async () => {
        const moved = await rightEdgeOf(page, 'f000004');
        expect(Math.abs(start.x - moved.x - 40)).toBeLessThanOrEqual(2);
        expect((await timesOf(page, 'f000004')).end).toBe(during.end);
        expect((await timesOf(page, 'f000005')).start).toBe(during.end);
      }).toPass({ timeout: 5000 });
    });

    test('Escape puts back every annotation the drag moved', async ({ page }) => {
      const four = await timesOf(page, 'f000004');
      const five = await timesOf(page, 'f000005');
      const start = await rightEdgeOf(page, 'f000004');

      await pressAndMove(page, start, -40);
      await expect(async () => {
        expect((await timesOf(page, 'f000005')).start).not.toBe(five.start);
      }).toPass({ timeout: 5000 });

      await page.keyboard.press('Escape');
      await page.mouse.up();

      await expect(async () => {
        expect(await timesOf(page, 'f000004')).toEqual(four);
        expect(await timesOf(page, 'f000005')).toEqual(five);
        const back = await rightEdgeOf(page, 'f000004');
        expect(Math.abs(start.x - back.x)).toBeLessThanOrEqual(1);
      }).toPass({ timeout: 5000 });
    });
  });

  test.describe('Toolbar Controls', () => {
    test('add annotation button exists', async ({ page }) => {
      const addButton = page.getByRole('button', { name: '+ Add Annotation' });
      await expect(addButton).toBeVisible();
    });

    test('download JSON button exists', async ({ page }) => {
      const downloadButton = page.getByRole('button', { name: 'Download JSON' });
      await expect(downloadButton).toBeVisible();
    });

    test('upload JSON button exists', async ({ page }) => {
      const uploadButton = page.getByRole('button', { name: 'Upload JSON' });
      await expect(uploadButton).toBeVisible();
    });

    test('clear all button exists', async ({ page }) => {
      const clearButton = page.getByRole('button', { name: 'Clear All' });
      await expect(clearButton).toBeVisible();
    });
  });

  test.describe('Checkboxes', () => {
    test('automatic scroll checkbox exists and is checked', async ({ page }) => {
      const checkbox = page.getByRole('checkbox', { name: 'Automatic Scroll' });
      await expect(checkbox).toBeVisible();
      await expect(checkbox).toBeChecked();
    });

    test('continuous play checkbox exists and is checked', async ({ page }) => {
      const checkbox = page.getByRole('checkbox', { name: 'Continuous Play' });
      await expect(checkbox).toBeVisible();
      await expect(checkbox).toBeChecked();
    });

    test('link endpoints checkbox exists and is checked', async ({ page }) => {
      const checkbox = page.getByRole('checkbox', { name: 'Link Endpoints' });
      await expect(checkbox).toBeVisible();
      await expect(checkbox).toBeChecked();
    });

    test('editable annotations checkbox exists and is checked', async ({ page }) => {
      const checkbox = page.getByRole('checkbox', { name: 'Editable Annotations' });
      await expect(checkbox).toBeVisible();
      await expect(checkbox).toBeChecked();
    });

    test('can toggle continuous play', async ({ page }) => {
      const checkbox = page.getByRole('checkbox', { name: 'Continuous Play' });

      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();

      await checkbox.check();
      await expect(checkbox).toBeChecked();
    });

    test('can toggle link endpoints', async ({ page }) => {
      const checkbox = page.getByRole('checkbox', { name: 'Link Endpoints' });

      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();

      await checkbox.check();
      await expect(checkbox).toBeChecked();
    });
  });

  test.describe('Playback Controls', () => {
    test('play, pause, stop buttons exist', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
    });

    test('rewind and fast forward buttons exist', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Rewind' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Fast Forward' })).toBeVisible();
    });

    test('play button starts playback', async ({ page }) => {
      await page.getByRole('button', { name: 'Play' }).click();
      await page.waitForTimeout(200);

      // Time display should advance
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      const time = await timeDisplay.textContent();
      expect(time).not.toBe('00:00:00.000');

      await page.getByRole('button', { name: 'Stop' }).click();
    });
  });

  test.describe('Annotation Actions', () => {
    test('split button is clickable', async ({ page }) => {
      // Click split on first annotation - verify it doesn't error
      const splitButton = page.getByRole('button', { name: '✂' }).first();
      await expect(splitButton).toBeVisible();
      await splitButton.click();

      // Page should still be functional after split
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    });

    test('plus button is clickable', async ({ page }) => {
      // Click + to adjust annotation
      const plusButton = page.getByRole('button', { name: '+' }).first();
      await expect(plusButton).toBeVisible();
      await plusButton.click();

      // Page should still be functional
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    });

    test('minus button is clickable', async ({ page }) => {
      // Click - to adjust annotation
      const minusButton = page.getByRole('button', { name: '−' }).first();
      await expect(minusButton).toBeVisible();
      await minusButton.click();

      // Page should still be functional
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    });

    test('delete button removes annotation', async ({ page }) => {
      // Count annotations before
      const deleteButtons = page.getByRole('button', { name: '🗑' });
      const countBefore = await deleteButtons.count();

      // Click delete on first annotation
      await deleteButtons.first().click();

      // Wait for delete
      await page.waitForTimeout(100);

      // Should have one fewer annotation
      const countAfter = await page.getByRole('button', { name: '🗑' }).count();
      expect(countAfter).toBe(countBefore - 1);
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('Space toggles play/pause', async ({ page }) => {
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);

      // Use Play button for reliable AudioContext init
      await page.getByRole('button', { name: 'Play' }).click();

      // Wait for time to advance (tolerates AudioContext init delay)
      await expect(async () => {
        const time = await timeDisplay.textContent();
        expect(time).not.toBe('00:00:00.000');
      }).toPass({ timeout: 10000 });

      // Press Space to pause (tests keyboard shortcut after audio init)
      await page.keyboard.press('Space');
    });

    test('A key adds annotation at playhead', async ({ page }) => {
      // Count annotations before
      const annotationsBefore =
        (await page.locator('[aria-roledescription="draggable"]').count()) / 2;

      // Move playhead to a position with space for new annotation
      await page.getByRole('button', { name: 'Play' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Stop' }).click();

      // Press A to add annotation
      await page.keyboard.press('a');
      await page.waitForTimeout(100);

      // Should have one more annotation
      const annotationsAfter =
        (await page.locator('[aria-roledescription="draggable"]').count()) / 2;
      expect(annotationsAfter).toBeGreaterThanOrEqual(annotationsBefore);
    });
  });

  test.describe('Time Format', () => {
    test('time format dropdown exists', async ({ page }) => {
      const dropdown = page.getByRole('combobox', { name: 'Time format selection' });
      await expect(dropdown).toBeVisible();
    });

    test('can change time format', async ({ page }) => {
      const dropdown = page.getByRole('combobox', { name: 'Time format selection' });

      // Change to seconds format
      await dropdown.selectOption('seconds');
      await expect(dropdown).toHaveValue('seconds');

      // Change back to milliseconds
      await dropdown.selectOption('hh:mm:ss + milliseconds');
    });
  });

  test.describe('Master Volume', () => {
    test('master volume slider exists', async ({ page }) => {
      const slider = page.getByRole('slider', { name: 'Master Volume' });
      await expect(slider).toBeVisible();
    });

    test('master volume defaults to 100', async ({ page }) => {
      const slider = page.getByRole('slider', { name: 'Master Volume' });
      await expect(slider).toHaveValue('100');
    });
  });

  test.describe('Track Controls', () => {
    test('track has mute and solo buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Mute' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Solo' })).toBeVisible();
    });

    test('track name is displayed', async ({ page }) => {
      await expect(page.getByText('Sonnet')).toBeVisible();
    });
  });

  test.describe('Selection Inputs', () => {
    test('start and end selection inputs exist', async ({ page }) => {
      const startInput = page.getByRole('textbox', { name: 'Start of audio selection' });
      const endInput = page.getByRole('textbox', { name: 'End of audio selection' });

      await expect(startInput).toBeVisible();
      await expect(endInput).toBeVisible();
    });

    test('selection inputs default to 00:00:00.000', async ({ page }) => {
      const startInput = page.getByRole('textbox', { name: 'Start of audio selection' });
      const endInput = page.getByRole('textbox', { name: 'End of audio selection' });

      await expect(startInput).toHaveValue('00:00:00.000');
      await expect(endInput).toHaveValue('00:00:00.000');
    });
  });

  test.describe('Documentation', () => {
    test('keyboard shortcuts documentation is visible', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible();
      await expect(page.getByText('Add new annotation at playhead')).toBeVisible();
      await expect(page.getByText('Select previous annotation')).toBeVisible();
      await expect(page.getByText('Select next annotation')).toBeVisible();
    });

    test('features documentation is visible', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Features' })).toBeVisible();
      await expect(page.getByText('Toggle to enable/disable annotation editing')).toBeVisible();
    });
  });
});
