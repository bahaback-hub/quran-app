import { expect, test } from '@playwright/test';

test.describe('Hifz Room — Web-only side drawer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#hifzRoomToggle')).toBeVisible({ timeout: 10000 });
  });

  test('opens from its left-edge handle and exposes its focused memorization controls', async ({ page }) => {
    await page.locator('#hifzRoomToggle').click();

    const room = page.locator('#hifzRoom');
    await expect(room).toHaveClass(/is-open/);
    await expect(room).toHaveAttribute('aria-hidden', 'false');
    await expect(room).not.toHaveAttribute('inert', '');
    await expect(room.locator('#hifzRoomTitle')).toHaveText(/غرفة الحفظ/);
    await expect(room.locator('#hifzRoomStart')).toBeVisible();
    await expect(page.locator('#hifzRoomBackdrop')).toHaveCSS('opacity', '1');

    const roomBox = await room.boundingBox();
    const viewport = page.viewportSize();
    expect(roomBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    // The room is a partially revealed left-edge curtain: its left edge stays
    // off-screen (negative x) while its visible right portion remains on screen.
    expect(roomBox!.x).toBeLessThan(0);
    expect(roomBox!.x + roomBox!.width).toBeGreaterThan(0);
    expect(roomBox!.x + roomBox!.width).toBeLessThanOrEqual(viewport!.width);
  });

  test('opens with H and closes with Escape without invoking the existing Hifdh shortcut', async ({ page }) => {
    const hifdhButton = page.locator('#hifdhBtn');
    await expect(hifdhButton).not.toHaveClass(/active/);

    await page.keyboard.press('h');
    await expect(page.locator('#hifzRoom')).toHaveClass(/is-open/);
    await expect(hifdhButton).not.toHaveClass(/active/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#hifzRoom')).not.toHaveClass(/is-open/);
    await expect(page.locator('#hifzRoom')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#hifzRoom')).toHaveAttribute('inert', '');
  });

  test('lets the reader prepare a portion, repetition, and private review from inside the room', async ({ page }) => {
    await page.locator('#hifzRoomToggle').click();

    const room = page.locator('#hifzRoom');
    await expect(room.locator('.hifz-room-steps li')).toHaveCount(3);
    await expect(room.locator('#hifzRoomSurah')).toHaveValue('1');
    await room.locator('#hifzRoomFrom').selectOption('2');
    await room.locator('#hifzRoomTo').selectOption('5');
    await room.locator('[data-hifz-repeat="15"]').click();
    await room.locator('[data-hifz-review="tomorrow"]').click();

    await expect(room.locator('#hifzRoomSummary')).toContainText(/2.*5.*15/);
    await expect(room.locator('[data-hifz-repeat="15"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(room.locator('[data-hifz-review="tomorrow"]')).toHaveAttribute('aria-pressed', 'true');

    await room.locator('#hifzRoomCustomRepeat').fill('37');
    await room.locator('#hifzRoomCustomRepeat').press('Tab');
    await expect(room.locator('#hifzRoomSummary')).toContainText(/2.*5.*37/);

    await room.locator('#hifzRoomReturn').click();
    await expect(room).not.toHaveClass(/is-open/);
  });

  test('runs the selected portion inside the focused room with text and audio controls', async ({ page }) => {
    await page.locator('#hifzRoomToggle').click();
    const room = page.locator('#hifzRoom');
    await room.locator('#hifzRoomFrom').selectOption('1');
    await room.locator('#hifzRoomTo').selectOption('2');
    await room.locator('[data-hifz-repeat="3"]').click();
    await room.locator('#hifzRoomStart').click();

    await expect(room).toHaveClass(/hifz-room-focused/);
    await expect(page.locator('#hifzRoomStage')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#hifzRoomStageText')).not.toBeEmpty();
    await expect(room.locator('#hifzRoomReciter')).toBeVisible();
    await room.locator('#hifzRoomSpeed').selectOption('1.25');
    await expect(page.locator('#speedSelect')).toHaveValue('1.25');
    await room.locator('#hifzRoomHideText').click();
    await expect(page.locator('#hifzRoomStageText')).toHaveText('۞');
    await room.locator('#hifzRoomHideText').click();
    await room.locator('#hifzRoomToggleRange').click();
    await expect(page.locator('#hifzRoomStageText')).not.toHaveText('۞');
    await room.locator('#hifzRoomEnd').click();
    await expect(room).not.toHaveClass(/hifz-room-focused/);
    await expect(page.locator('#hifzRoomStage')).toHaveAttribute('aria-hidden', 'true');
  });

  test('opens when its left-edge handle is dragged toward the reader', async ({ page }) => {
    const handle = page.locator('#hifzRoomToggle');
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + 160, box!.y + box!.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect(page.locator('#hifzRoom')).toHaveClass(/is-open/);
    await expect(page.locator('#hifzRoom')).toHaveAttribute('aria-hidden', 'false');
  });

  test('keeps the room hidden when the Capacitor-native class is present', async ({ page }) => {
    await page.locator('body').evaluate((body) => body.classList.add('capacitor-native'));
    await expect(page.locator('#hifzRoom')).toHaveCSS('display', 'none');
    await expect(page.locator('#hifzRoomToggle')).toHaveCSS('display', 'none');
    await expect(page.locator('#hifzRoomBackdrop')).toHaveCSS('display', 'none');
    await expect(page.locator('#hifzRoomStage')).toHaveCSS('display', 'none');
  });
});
