import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { renderedTextContrast } from './helpers/renderedContrast';
import { auraFromHue } from '../src/shared/utils/aura';

const fixture = '/?e2eRoom=public&e2eSync=on&e2eCatalog=wide&e2eAutoplay=on';
const surfaces = [
  'music',
  'player',
  'release',
  'queue',
  'tip',
  'rooms',
  'chat',
  'people',
  'requests',
  'share',
  'gift',
  'Overview',
  'Releases',
  'Earnings',
  'Rights'
];

for (const width of [390, 1440]) {
  for (const surface of surfaces) {
    test(`accessible ${surface} at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if (['Overview', 'Releases', 'Earnings', 'Rights'].includes(surface)) {
        await page.goto('/artists?e2eArtist=happy');
        await page.getByTestId('artist-name-input').fill('E2E Artist');
        await page.getByLabel(/I understand and consent/i).check();
        await page.getByTestId('create-artist-profile').click();
        await expect(page.getByRole('dialog')).toContainText('Artist registered');
        await page.getByRole('button', { name: 'Close', exact: true }).click();
        await page.getByRole('tab', { name: surface, exact: true }).click();
      } else if (surface === 'gift') {
        await page.goto('/');
        await page.locator('.catalogue-card .artist-text-button').first().click();
        const gift = page.getByRole('button', { name: 'Send a gift', exact: true });
        await expect(gift).toBeVisible();
        await gift.click();
        await expect(page.locator('.artist-gift-dialog').getByLabel('Gift amount (PAS)')).toBeVisible();
      } else {
        await page.goto(fixture);
        await expect(page.getByTestId('track-card')).toHaveCount(13);
        if (surface === 'rooms') {
          await page
            .locator(width <= 768 ? '.bottom-nav' : '.topbar')
            .getByRole('button', { name: 'Rooms', exact: true })
            .click();
        } else if (surface !== 'music') {
          await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
          if (['release', 'queue', 'tip'].includes(surface)) {
            await page
              .getByRole('button', { name: { release: 'About this release', queue: 'Queue', tip: 'Tip this track' }[surface], exact: true })
              .click();
            await expect(page.getByRole('dialog')).toBeVisible();
          } else if (['chat', 'people', 'requests', 'share'].includes(surface)) {
            await page.getByRole('button', { name: 'Open room', exact: true }).click();
            await page.getByLabel('Your name in the room').fill('Accessibility host');
            await page.getByRole('button', { name: 'Open the room', exact: true }).click();
            await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
            if (surface === 'share') await page.getByRole('button', { name: 'Share room', exact: true }).click();
            else if (width <= 768) await page.getByRole('tab', { name: surface === 'people' ? /People/ : surface === 'requests' ? /Queue/ : 'Chat' }).click();
          }
        }
      }
      await page.evaluate(() => document.fonts.ready);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      await info.attach('accessibility', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
      expect(
        results.violations.map(item => ({ rule: item.id, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))
      ).toEqual([]);
      expect(
        results.incomplete.filter(item => item.id !== 'color-contrast').map(item => ({ rule: item.id, nodes: item.nodes.map(node => node.target) }))
      ).toEqual([]);
      const contrast = await renderedTextContrast(page);
      await info.attach('rendered-contrast', { body: JSON.stringify(contrast, null, 2), contentType: 'application/json' });
      expect(contrast.length).toBeGreaterThan(0);
      expect(contrast.filter(sample => sample.ratio < sample.minimum)).toEqual([]);
    });
  }
}

for (const width of [390, 1440]) {
  for (const surface of ['player', 'room']) {
    test(`rendered text contrast survives cover hues in ${surface} at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(fixture);
      await page.getByRole('button', { name: /^Play E2E Public Room Track by/ }).click();
      await expect(page.locator('html')).toHaveAttribute('data-aura-source', 'cover');
      if (surface === 'room') {
        await page.getByRole('button', { name: 'Open room', exact: true }).click();
        await page.getByLabel('Your name in the room').fill('Contrast host');
        await page.getByRole('button', { name: 'Open the room', exact: true }).click();
        await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
      }
      await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
      for (const hue of [0, 60, 120, 180, 240, 300]) {
        await page.evaluate(aura => {
          const style = document.documentElement.style;
          style.setProperty('--aura-a', aura.a);
          style.setProperty('--aura-b', aura.b);
          style.setProperty('--aura-accent', aura.accent);
          style.setProperty('--aura-hue', String(aura.hue));
        }, auraFromHue(hue));
        const contrast = await renderedTextContrast(page);
        await info.attach(`contrast-${hue}`, { body: JSON.stringify(contrast), contentType: 'application/json' });
        expect(contrast.length).toBeGreaterThan(5);
        expect(
          contrast.filter(sample => sample.ratio < sample.minimum),
          `Hue ${hue}`
        ).toEqual([]);
      }
    });
  }
}
