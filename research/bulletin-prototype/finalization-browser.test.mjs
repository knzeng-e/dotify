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

test('instrumented real AAC control finalizes naturally in both modes and retains markers after reload', { timeout: 180000 }, async () => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-finalization-browser-'));
  let server, browser;
  try {
    const source = join(parent, 'source'),
      blake = join(parent, 'blake'),
      out = join(parent, 'product');
    const options = { profile: 'continuity' };
    await prepare(source, encryptedContinuityFixture, options);
    await prepareReaddressedAac(source, blake, options);
    await buildMobile(blake, out, { ...options, acknowledgePublicTestKey: true });
    server = await preview({
      configFile: false,
      envDir: false,
      root: join(parent, 'preview-root'),
      build: { outDir: out },
      preview: { host: '127.0.0.1', port: 0 }
    });
    const origin = server.resolvedUrls.local[0];
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [],
      external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (!request.url().startsWith(origin) && !request.url().startsWith('blob:')) external.push(request.url());
    });
    // Real Chromium MSE + an explicit always-on managed-demand shim. This
    // exercises the lab wrapper with real AAC, not Safari/iOS managed behavior.
    await page.addInitScript(() => {
      const Native = globalThis.MediaSource;
      class ManagedDemandShim extends Native {
        streaming = true;
        constructor() {
          super();
          this.addEventListener('sourceopen', () => this.dispatchEvent(new Event('startstreaming')));
        }
      }
      Object.defineProperty(globalThis, 'MediaSource', { value: undefined, configurable: true });
      Object.defineProperty(globalThis, 'ManagedMediaSource', { value: ManagedDemandShim, configurable: true });
    });
    await page.goto(origin);
    assert.equal(await page.locator('#diagnostic-version').textContent(), '0.3.1');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const reports = [];
    for (const policy of ['after-final-append', 'near-playback-end']) {
      await page.selectOption('#transport', 'local');
      await page.selectOption('#finish-policy', policy);
      await page.click('#play');
      await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).outcome === 'playing');
      assert.equal(await page.locator('#finish-policy').isDisabled(), true);
      await page.locator('#audio').evaluate(audio => {
        audio.playbackRate = 4;
      });
      await page.waitForFunction(() => document.querySelector('#audio').currentTime > 10, {}, { timeout: 15000 });
      await page.click('#mark-cut'); // Synthetic action, never reported as human audibility proof.
      try {
        await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).outcome === 'ended', {}, { timeout: 25000 });
      } catch (error) {
        console.log(
          JSON.stringify(
            await page.evaluate(() => {
              const report = JSON.parse(document.querySelector('#report').textContent),
                audio = document.querySelector('#audio');
              return {
                policy: report.finalizationPolicy,
                outcome: report.outcome,
                error: report.error,
                mediaTime: audio.currentTime,
                duration: audio.duration,
                buffered: Array.from({ length: audio.buffered.length }, (_, i) => [audio.buffered.start(i), audio.buffered.end(i)]),
                events: report.events.slice(-12)
              };
            })
          )
        );
        throw error;
      }
      const report = JSON.parse(await page.locator('#saved-output').inputValue());
      reports.push(report);
      assert.equal(report.reader, 'managed');
      assert.equal(report.finalizationPolicy, policy);
      assert.equal(report.finalizationExperimentApplied, true);
      assert.equal(report.operatorHeardAudio, false);
      assert.ok(report.events.some(e => e.name === 'audible-cut-marked' && e.mediaSeconds > 10));
      assert.ok(report.events.some(e => e.name === 'segment-append-complete' && e.segmentIndex === 15));
      assert.ok(report.events.some(e => e.name === 'sourceended' && e.sourceState === 'ended'));
      assert.ok(report.events.some(e => e.name === 'ended' && Math.abs(e.mediaSeconds - 64) < 0.15));
      const end = report.events.filter(e => e.name === 'end-of-stream-called');
      assert.equal(end.length, 1);
      assert.ok(policy === 'near-playback-end' ? end[0].mediaSeconds >= 63 : end[0].mediaSeconds < 50);
      assert.equal(await page.locator('#mark-cut').isDisabled(), true);
      assert.equal(await page.locator('#finish-policy').isDisabled(), false);
      await page.reload();
      assert.equal(JSON.parse(await page.locator('#saved-output').inputValue()).id, report.id);
    }
    assert.equal(reports[0].root, reports[1].root);
    // Stop while finalization is armed but deferred, then start a clean attempt.
    await page.selectOption('#transport', 'local');
    await page.selectOption('#finish-policy', 'near-playback-end');
    await page.click('#play');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).outcome === 'playing');
    await page.locator('#audio').evaluate(audio => {
      audio.currentTime = 40;
    });
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).events.some(e => e.name === 'end-of-stream-requested'));
    await page.click('#stop');
    const stopped = JSON.parse(await page.locator('#saved-output').inputValue());
    assert.equal(stopped.outcome, 'stopped');
    assert.ok(!stopped.events.some(e => e.name === 'end-of-stream-called'));
    assert.equal(await page.locator('#audio').getAttribute('src'), null);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    await page.screenshot({ path: join(tmpdir(), 'dotify-finalization-mobile-preview.png'), fullPage: true });
  } finally {
    await browser?.close();
    await new Promise(resolve => (server ? server.httpServer.close(resolve) : resolve()));
    await rm(parent, { recursive: true, force: true });
  }
});
