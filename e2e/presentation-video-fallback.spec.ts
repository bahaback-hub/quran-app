import { expect, test } from './fixtures/mock-network';

test('retries a motion background after autoplay is denied', async ({ page }) => {
  await page.addInitScript(() => {
    let allowPresentationVideo = false;
    document.addEventListener(
      'click',
      (event) => {
        if ((event.target as HTMLElement).closest('#presVideoRetryBtn')) {
          allowPresentationVideo = true;
        }
      },
      true,
    );
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.classList.contains('pres-video-bg')) {
        return allowPresentationVideo
          ? Promise.resolve()
          : Promise.reject(new DOMException('Autoplay denied for test', 'NotAllowedError'));
      }
      return originalPlay.call(this);
    };
  });

  await page.goto('/');
  const helpClose = page.locator('#helpCloseBtn');
  if (await helpClose.isVisible().catch(() => false)) {
    await helpClose.click();
  }
  await expect(page.locator('#surahContent .ayah')).toHaveCount(7, { timeout: 15000 });
  await page.locator('#viewPresBtn').click({ force: true });
  await expect(page.locator('#presentationOverlay')).toBeVisible();
  // The picker only responds once the deferred presentation init has bound its
  // handlers. Under a loaded CI runner that init may lag; re-click until the
  // toggle state actually flips (state is checked before each click, so this
  // never double-toggles).
  const backgroundBtn = page.locator('#presBackgroundBtn');
  for (let attempt = 0; attempt < 30; attempt++) {
    if ((await backgroundBtn.getAttribute('aria-expanded')) === 'true') {
      break;
    }
    await backgroundBtn.click();
    await page.waitForTimeout(300);
  }
  await expect(backgroundBtn).toHaveAttribute('aria-expanded', 'true', { timeout: 10000 });
  await expect(page.locator('[data-pres-bg-video="wave"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-pres-bg-video="wave"]').click();

  const retryButton = page.locator('#presVideoRetryBtn');
  await expect(retryButton).toBeVisible();
  await retryButton.click();
  await expect(retryButton).toBeHidden();
});
