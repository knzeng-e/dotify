import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '../../web/node_modules/playwright/index.mjs';
import { preview } from '../../web/node_modules/vite/dist/node/index.js';
import { buildMobile } from './mobile-package.mjs';
import { prepare } from './canary.mjs';
import { encryptedAacFixture } from './aac-fixture.mjs';
import { prepareReaddressedAac } from './readdress-aac.mjs';
test('standalone mobile build plays bundled control, retains evidence on reload and fails native mode without fallback', { timeout: 100000 }, async () => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-mobile-browser-'));
  let server, browser;
  try {
    const source = join(parent, 'source'),
      blake = join(parent, 'blake'),
      out = join(parent, 'product');
    await prepare(source, encryptedAacFixture);
    await prepareReaddressedAac(source, blake);
    const build = await buildMobile(blake, out, { acknowledgePublicTestKey: true });
    assert.equal(build.networkWrites, 0);
    await assert.rejects(buildMobile(blake, out, { acknowledgePublicTestKey: true }), /EEXIST/);
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
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.click('#play');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).outcome === 'failed');
    assert.ok(
      requests.every(url => !url.includes('decoder-control')),
      'Native mode must not load the bundled decoder control'
    );
    await page.selectOption('#transport', 'local');
    await page.click('#play');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).outcome === 'playing');
    await page.locator('#audio').evaluate(audio => {
      audio.pause();
      audio.currentTime = 3;
    });
    await page.locator('#audio').evaluate(audio => audio.play());
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).outcome === 'ended', {}, { timeout: 20000 });
    const first = JSON.parse(await page.locator('#saved-output').inputValue());
    assert.equal(first.transport, 'bundled-decoder-control');
    assert.equal(first.operatorHeardAudio, false);
    assert.ok(first.events.some(event => event.name === 'pause'));
    assert.ok(first.events.some(event => event.name === 'seeking'));
    assert.ok(!JSON.stringify(first).includes('"key"'));
    await page.reload();
    assert.equal(JSON.parse(await page.locator('#saved-output').inputValue()).id, first.id);
    await page.click('#play'); // Native is the default, no control fallback.
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).outcome === 'failed');
    const failed = JSON.parse(await page.locator('#report').textContent());
    assert.equal(failed.transport, 'native-preimage');
    assert.equal(failed.insideHost, false);
    assert.equal(failed.reads.length, 0);
    assert.equal(await page.locator('#saved option').count(), 3);
    await page.selectOption('#transport', 'local');
    await page.click('#play');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent).outcome === 'playing');
    await page.click('#stop');
    assert.equal(await page.locator('#audio').evaluate(audio => audio.paused), true);
    assert.equal(await page.locator('#audio').getAttribute('src'), null);
    await page.reload();
    assert.equal(await page.locator('#saved option').count(), 4);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    assert.equal(JSON.parse(await readFile(join(out, 'diagnostic-build.json'), 'utf8')).requiresSeparateDestinationApproval, true);
    await page.screenshot({ path: join(tmpdir(), 'dotify-mobile-diagnostic-preview.png'), fullPage: true });
  } finally {
    await browser?.close();
    await new Promise(resolve => (server ? server.httpServer.close(resolve) : resolve()));
    await rm(parent, { recursive: true, force: true });
  }
});
