import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '../../web/node_modules/playwright/index.mjs';
import { preview } from '../../web/node_modules/vite/dist/node/index.js';
import { buildMobile } from './mobile-package.mjs';
import { prepare } from './canary.mjs';
import { encryptedContinuityFixture } from './aac-fixture.mjs';
import { prepareReaddressedAac } from './readdress-aac.mjs';
const options = { profile: 'continuity' };
test('64-second compiled control fetches after playback starts and preserves manual actions across reload', { timeout: 120000 }, async () => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-continuity-browser-'));
  let server, browser;
  try {
    const source = join(parent, 'source'),
      blake = join(parent, 'blake'),
      out = join(parent, 'product');
    await prepare(source, encryptedContinuityFixture, options);
    await prepareReaddressedAac(source, blake, options);
    const build = await buildMobile(blake, out, { ...options, acknowledgePublicTestKey: true });
    assert.equal(build.durationSeconds, 64);
    server = await preview({
      configFile: false,
      envDir: false,
      root: join(parent, 'preview-root'),
      build: { outDir: out },
      preview: { host: '127.0.0.1', port: 0 }
    });
    const origin = server.resolvedUrls.local[0];
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [],
      external = [],
      requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', r => {
      requests.push(r.url());
      if (!r.url().startsWith(origin) && !r.url().startsWith('blob:')) external.push(r.url());
    });
    await page.goto(origin);
    assert.equal(await page.locator('#duration').textContent(), '01:04');
    assert.equal(await page.locator('#clip-duration').textContent(), '64 seconds.');
    assert.equal(await page.locator('#attempt-limit').textContent(), '180');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.click('#play');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).outcome === 'failed');
    assert.ok(
      requests.every(url => !url.includes('decoder-control')),
      'No control load or HTTP fallback in native mode'
    );
    await page.selectOption('#transport', 'local');
    await page.click('#play');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).outcome === 'playing');
    // Accelerated browser regression only: this is not a real-device latency or network measurement.
    await page.locator('#audio').evaluate(audio => {
      audio.playbackRate = 4;
    });
    await page.waitForFunction(() => document.querySelector('#audio').currentTime > 36, {}, { timeout: 25000 });
    await page.locator('#audio').evaluate(audio => audio.pause());
    await page.locator('#audio').evaluate(audio => {
      audio.currentTime = 48;
    });
    await page.locator('details').first().locator('summary').click();
    await page.fill('#network', 'Simulated marker, not a verified handover');
    await page.click('#mark-network');
    await page.locator('#audio').evaluate(audio => audio.play());
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).outcome === 'ended', {}, { timeout: 15000 });
    const report = JSON.parse(await page.locator('#saved-output').inputValue());
    assert.equal(report.fixtureProfile, 'continuity');
    assert.equal(report.fixtureDurationSeconds, 64);
    assert.equal(report.progressive, true);
    assert.equal(report.operatorHeardAudio, false);
    assert.ok(report.events.some(e => e.name === 'progress' && e.mediaSeconds > 30));
    assert.ok(report.events.some(e => e.name === 'pause' && e.mediaSeconds > 36 && e.mediaSeconds < 64));
    assert.ok(report.events.some(e => e.name === 'seeking'));
    assert.ok(report.events.some(e => e.name === 'network-switch-marked' && e.networkNote.includes('not a verified')));
    assert.ok(
      report.reads.some(r => r.mediaSeconds > 1),
      'Reads continue during playback beyond initial startup'
    );
    assert.ok(report.events.some(e => e.name === 'ended' && Math.abs(e.mediaSeconds - 64) < 0.15));
    assert.equal(await page.locator('#mark-network').isDisabled(), true);
    await page.reload();
    assert.equal(JSON.parse(await page.locator('#saved-output').inputValue()).id, report.id);
    await page.selectOption('#transport', 'local');
    await page.click('#play');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).outcome === 'playing');
    await page.click('#stop');
    assert.equal(await page.locator('#audio').evaluate(audio => audio.paused), true);
    assert.equal(await page.locator('#audio').getAttribute('src'), null);
    assert.equal(await page.locator('#mark-network').isDisabled(), true);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(tmpdir(), 'dotify-continuity-mobile-preview.png'), fullPage: true });
  } finally {
    await browser?.close();
    await new Promise(resolve => (server ? server.httpServer.close(resolve) : resolve()));
    await rm(parent, { recursive: true, force: true });
  }
});
