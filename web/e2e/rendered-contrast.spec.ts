import { expect, test } from '@playwright/test';
import { renderedTextContrast } from './helpers/renderedContrast';

test('contrast uses the same geometry as its screenshot when live content moves a control', async ({ page }) => {
  await page.setContent(
    '<style>body { background: #111; } button { position:absolute; top:20px; left:20px; color:#000; background:#fff; font:20px sans-serif; padding:20px; }</style><button>Join</button>'
  );
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if ([...document.querySelectorAll('style')].some(style => style.textContent?.includes('-webkit-text-fill-color'))) {
        document.querySelector('button')!.style.top = '200px';
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
  const samples = await renderedTextContrast(page);
  expect(samples).toHaveLength(1);
  expect(samples[0].ratio).toBeGreaterThan(20);
  expect(await page.locator('button').evaluate(element => element.getBoundingClientRect().top)).toBe(200);
});

test('stable low contrast is still reported without retrying it away', async ({ page }) => {
  await page.setContent(
    '<style>body { background:#111; } button { color:#222; background:#111; font:20px sans-serif; padding:20px; }</style><button>Join</button>'
  );
  const samples = await renderedTextContrast(page);
  expect(samples).toHaveLength(1);
  expect(samples[0].ratio).toBeLessThan(samples[0].minimum);
});
