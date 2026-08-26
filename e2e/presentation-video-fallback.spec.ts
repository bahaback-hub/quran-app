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
  await expect(page.locator('#surahContent .ayah')).toHaveCount(7);
  await page.locator('#viewPresBtn').click({ force: true });
  await expect(page.locator('#presentationOverlay')).toBeVisible();
  await page.locator('#presBackgroundBtn').click();
  await page.locator('[data-pres-bg-video="wave"]').click();

  const retryButton = page.locator('#presVideoRetryBtn');
  await expect(retryButton).toBeVisible();
  await retryButton.click();
  await expect(retryButton).toBeHidden();
});
