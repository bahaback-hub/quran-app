import { expect, test } from '@playwright/test';

test.describe('Hifz Room — Web-only side drawer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.ayah[data-surah="1"]').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#hifzRoomToggle')).toBeVisible({ timeout: 10000 });
  });

  test('opens from its right-edge handle and carries the approved Rawdah background', async ({ page }) => {
    await page.locator('#hifzRoomToggle').click();

    const room = page.locator('#hifzRoom');
    await expect(room).toHaveClass(/is-open/);
    await expect(room).toHaveAttribute('aria-hidden', 'false');
    await expect(room).not.toHaveAttribute('inert', '');
    await expect(room.locator('#hifzRoomTitle')).toHaveText(/غرفة الحفظ/);
    await expect(room.locator('.hifz-room-scene')).toHaveCSS('background-image', /files\.manuscdn\.com/);
    await expect(room.locator('#hifzRoomStart')).toBeVisible();
    await expect(page.locator('#hifzRoomBackdrop')).toHaveCSS('opacity', '1');

    const roomBox = await room.boundingBox();
    const viewport = page.viewportSize();
    expect(roomBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(Math.round(roomBox!.x + roomBox!.width)).toBe(viewport!.width);
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

  test('opens when its right-edge handle is dragged toward the reader', async ({ page }) => {
    const handle = page.locator('#hifzRoomToggle');
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x - 160, box!.y + box!.height / 2, { steps: 8 });
    await page.mouse.up();

    await expect(page.locator('#hifzRoom')).toHaveClass(/is-open/);
    await expect(page.locator('#hifzRoom')).toHaveAttribute('aria-hidden', 'false');
  });

  test('keeps the room hidden when the Capacitor-native class is present', async ({ page }) => {
    await page.locator('body').evaluate((body) => body.classList.add('capacitor-native'));
    await expect(page.locator('#hifzRoom')).toHaveCSS('display', 'none');
    await expect(page.locator('#hifzRoomToggle')).toHaveCSS('display', 'none');
    await expect(page.locator('#hifzRoomBackdrop')).toHaveCSS('display', 'none');
  });
});
