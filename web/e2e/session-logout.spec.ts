import { expect, test, type Page } from '@playwright/test';

async function seedLogout(page: Page) {
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
}

test('reloaded pending logout stays inactive and can be completed from its notice', async ({ page }) => {
  let healthy = false;
  let attempts = 0;
  await page.route('https://logout-api.test/**', async route => {
    if (!route.request().url().endsWith('/api/auth/logout')) return route.fulfill({ status: 404, json: {} });
    expect(route.request().postDataJSON()).toEqual({ sessionToken: 'inactive-fixture-token' });
    attempts++;
    return route.fulfill({ status: healthy ? 200 : 503, json: healthy ? { ok: true } : { code: 'SESSION_REVOCATION_UNAVAILABLE' } });
  });
  await seedLogout(page);
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

for (const status of [200, 503]) {
  test(`late manual logout ${status} preserves a newer payment's feedback`, async ({ page }) => {
    await seedLogout(page);
    let attempts = 0;
    let release: (() => void) | undefined;
    await page.route('https://logout-api.test/**', async route => {
      if (!route.request().url().endsWith('/api/auth/logout')) return route.fulfill({ status: 404, json: {} });
      if (++attempts === 1) return route.fulfill({ status: 503, json: {} });
      await new Promise<void>(resolve => {
        release = resolve;
      });
      return route.fulfill({ status, json: {} });
    });
    await page.goto('/e2e/fixtures/logout-feedback.html');
    await expect(page.getByRole('heading', { name: 'Sign-out still finishing' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry sign-out', exact: true }).click();
    await expect.poll(() => Boolean(release)).toBe(true);
    await page.evaluate(() => window.logoutFeedbackFixture.showPayment());
    await expect(page.getByRole('heading', { name: 'Tip confirmation', exact: true })).toBeVisible();
    const settled = page.evaluate(() => window.logoutFeedbackFixture.waitForRetry());
    await expect.poll(() => page.evaluate(() => window.logoutFeedbackFixture.awaitingRetry)).toBe(true);
    release!();
    await settled;
    await expect(page.getByTestId('feedback-operation')).toHaveText('payment-new');
    await expect(page.getByRole('heading', { name: 'Tip confirmation', exact: true })).toBeVisible();
  });
}

test('late startup failure defers its warning while payment feedback is active, then can show it later', async ({ page }) => {
  await seedLogout(page);
  let release: (() => void) | undefined;
  let attempts = 0;
  await page.route('https://logout-api.test/**', async route => {
    if (!route.request().url().endsWith('/api/auth/logout')) return route.fulfill({ status: 404, json: {} });
    if (++attempts === 1)
      await new Promise<void>(resolve => {
        release = resolve;
      });
    return route.fulfill({ status: 503, json: {} });
  });
  await page.goto('/e2e/fixtures/logout-feedback.html');
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.evaluate(() => window.logoutFeedbackFixture.showPayment());
  const settled = page.evaluate(() => window.logoutFeedbackFixture.waitForRetry());
  await expect.poll(() => page.evaluate(() => window.logoutFeedbackFixture.awaitingRetry)).toBe(true);
  release!();
  await settled;
  await expect(page.getByTestId('feedback-operation')).toHaveText('payment-new');
  await expect(page.getByRole('heading', { name: 'Tip confirmation', exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.logoutFeedbackFixture.closeFeedback();
  });
  await expect(page.getByTestId('feedback-operation')).toHaveText('none');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('heading', { name: 'Sign-out still finishing' })).toBeVisible();
});

test('a late sign-in with unavailable Host storage immediately surfaces failed logout', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Host storage unavailable');
    };
  });
  let release: (() => void) | undefined;
  await page.route('https://logout-api.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session' && route.request().method() === 'GET') return route.fulfill({ json: { available: true } });
    if (path === '/api/auth/nonce') return route.fulfill({ json: { nonce: 'a'.repeat(48), expiresAt: new Date(Date.now() + 60_000).toISOString() } });
    if (path === '/api/auth/session') {
      await new Promise<void>(resolve => {
        release = resolve;
      });
      return route.fulfill({ json: { sessionToken: 'late-session', expiresAt: new Date(Date.now() + 3_600_000).toISOString() } });
    }
    return route.fulfill({ status: 503, json: {} });
  });
  await page.goto('/e2e/fixtures/logout-feedback.html');
  await expect.poll(() => page.evaluate(() => Boolean(window.logoutFeedbackFixture))).toBe(true);
  const signIn = page.evaluate(() => window.logoutFeedbackFixture.beginSignIn());
  await expect.poll(() => Boolean(release)).toBe(true);
  await page.evaluate(() => window.logoutFeedbackFixture.disconnect());
  release!();
  expect(await signIn).toBe('SESSION_CANCELLED');
  await expect(page.getByRole('heading', { name: 'Sign-out still finishing' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry sign-out', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
