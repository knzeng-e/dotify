import { expect, test } from '@playwright/test';

test('reloaded pending logout stays inactive and can be completed from its notice', async ({ page }) => {
  let healthy = false;
  let attempts = 0;
  await page.route('https://logout-api.test/**', async route => {
    if (!route.request().url().endsWith('/api/auth/logout')) return route.fulfill({ status: 404, json: {} });
    expect(route.request().postDataJSON()).toEqual({ sessionToken: 'inactive-fixture-token' });
    attempts++;
    return route.fulfill({ status: healthy ? 200 : 503, json: healthy ? { ok: true } : { code: 'SESSION_REVOCATION_UNAVAILABLE' } });
  });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('logout-fixture-seeded')) return;
    localStorage.setItem(
      `dotify:logout:v1:${encodeURIComponent('https://logout-api.test')}:fixture`,
      JSON.stringify({
        token: 'inactive-fixture-token',
        address: '0x1111111111111111111111111111111111111111',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString()
      })
    );
    sessionStorage.setItem('logout-fixture-seeded', 'yes');
  });
  await page.goto('/e2e/fixtures/product-host.html?e2eRoom=public');
  await expect(page.getByRole('heading', { name: 'Sign-out still finishing' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign-out still finishing' })).toBeVisible();
  expect(attempts).toBeGreaterThanOrEqual(2);
  healthy = true;
  await page.getByRole('button', { name: 'Retry sign-out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Signed out', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('dotify:logout:v1:')).length)).toBe(0);
});
