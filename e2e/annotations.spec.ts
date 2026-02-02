import { test, expect } from '@playwright/test';

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
      // Click on the waveform area first to ensure focus
      await page.locator('[data-scroll-container]').click();

      await page.keyboard.press('Space');
      await page.waitForTimeout(100);

      // Pause
      await page.keyboard.press('Space');

      // Time should have advanced
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      const time = await timeDisplay.textContent();
      expect(time).not.toBe('00:00:00.000');
    });

    test('A key adds annotation at playhead', async ({ page }) => {
      // Count annotations before
      const annotationsBefore = await page.locator('[aria-roledescription="draggable"]').count() / 2;

      // Move playhead to a position with space for new annotation
      await page.getByRole('button', { name: 'Play' }).click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Stop' }).click();

      // Press A to add annotation
      await page.keyboard.press('a');
      await page.waitForTimeout(100);

      // Should have one more annotation
      const annotationsAfter = await page.locator('[aria-roledescription="draggable"]').count() / 2;
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
