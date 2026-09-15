import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`design review surfaces remain navigable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
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
}
