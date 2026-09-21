import { expect, test } from '@playwright/test';

const reviewHeights: Record<number, number> = { 360: 800, 390: 844, 768: 1024, 1440: 1000 };

for (const width of [360, 390, 768, 1440]) {
  test(`design review surfaces remain navigable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: reviewHeights[width] });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?e2eRoom=public&e2eCatalog=wide');
    await expect(page.getByTestId('track-card')).toHaveCount(13);
    const targetNotes: Record<string, unknown> = {};
    for (const surface of ['Music', 'Rooms', 'You', 'Artist']) {
      if (surface === 'Artist') {
        await page.getByRole('button', { name: 'Music', exact: true }).click();
        await page.locator('.catalogue-card .artist-text-button').first().click();
      } else if (surface !== 'Music') {
        await page.getByRole('button', { name: surface, exact: true }).click();
      }
      await expect(page.getByRole('main')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const typography = await page.evaluate(() => {
        const visibleTextSizes = Array.from(document.querySelectorAll<HTMLElement>('body *')).flatMap(element => {
          if (element.closest('.sr-only') || !element.getClientRects().length) return [];
          const hasDirectText = Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
          if (!hasDirectText) return [];
          return [Number.parseFloat(getComputedStyle(element).fontSize)];
        });
        const probe = document.createElement('span');
        probe.textContent = 'Lord Ékomy Ndong ☥';
        probe.style.cssText = 'position:fixed;left:-9999px;font:16px var(--font-interface)';
        document.body.append(probe);
        const symbolWidth = probe.getBoundingClientRect().width;
        const family = getComputedStyle(probe).fontFamily;
        probe.remove();
        return { minimum: Math.min(...visibleTextSizes), symbolWidth, family };
      });
      expect(typography.minimum).toBeGreaterThanOrEqual(12);
      expect(typography.symbolWidth).toBeGreaterThan(0);
      expect(typography.family).toContain('Segoe UI Symbol');
      await page.screenshot({ path: testInfo.outputPath(`${surface.toLowerCase()}.png`), fullPage: true });
      // Review evidence, not an automated WCAG verdict: inline links and
      // composite targets need a human reading of context and actual hit areas.
      targetNotes[surface] = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('button,a,input,select')).flatMap(element => {
          const box = element.getBoundingClientRect();
          if (!box.width || !box.height || box.bottom < 0 || box.top > innerHeight) return [];
          if (box.width >= 44 && box.height >= 44) return [];
          return [
            {
              name: element.getAttribute('aria-label') || element.title || element.textContent?.trim().slice(0, 70),
              width: Math.round(box.width),
              height: Math.round(box.height)
            }
          ];
        })
      );
    }
    await testInfo.attach('touch-target-review', { body: JSON.stringify(targetNotes, null, 2), contentType: 'application/json' });
  });

  test(`core navigation reflows at 200% text at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: reviewHeights[width] });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?e2eRoom=public&e2eCatalog=wide');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.evaluate(() => document.fonts.ready);

    for (const destination of ['Music', 'Rooms', 'You'] as const) {
      const destinationButton = page.getByRole('button', { name: destination, exact: true });
      await destinationButton.click();
      // The same <main> remains mounted across these client-side views. Wait
      // for the selected view and its enlarged-font layout to settle before
      // measuring the document instead of sampling the previous frame.
      await expect(destinationButton).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('main')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}
