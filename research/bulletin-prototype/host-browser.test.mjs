// Real browser codec/control evidence only. Never a substitute for installed Hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '../../web/node_modules/playwright/index.mjs';
import { serveFixture, ORIGIN } from './host-server.mjs';
import { prepare } from './canary.mjs';
import { addressingFixture } from './addressing.mjs';
import { encryptedAacFixture } from './aac-fixture.mjs';

test('browser plays authenticated generated AAC, stops cleanly and refuses native fallback', { timeout: 100_000 }, async () => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-host-browser-'));
  let server, browser;
  try {
    const dir = join(parent, 'aac');
    await prepare(dir, encryptedAacFixture);
    server = await serveFixture(dir);
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const objectPaths = [];
    page.on('request', request => {
      if (request.url().includes('/canary/block/')) objectPaths.push(request.url());
    });
    await page.goto(ORIGIN);
    await page.selectOption('#transport', 'local');
    await page.fill('#environment', 'Automated Chromium; not physical Product');
    await page.fill('#network', 'Loopback; no Bulletin reads');
    await page.click('#play');
    await page.waitForFunction(
      () => ['ended', 'failed'].includes(JSON.parse(document.querySelector('#report').textContent || '{}').outcome),
      {},
      { timeout: 60_000 }
    );
    const report = JSON.parse(await page.locator('#report').textContent());
    assert.equal(report.outcome, 'ended', JSON.stringify(report));
    assert.ok(report.events.find(e => e.name === 'ended').mediaSeconds >= 7.8);
    assert.ok(report.firstPlayingEventMs > 0);
    assert.equal(report.transport, 'local-control');
    assert.equal(report.audibleFirstSoundMeasured, false);
    assert.equal(report.operatorHeardAudio, false);
    assert.ok(report.reads.length > 0);
    assert.ok(!JSON.stringify(report).includes('"key"'));
    assert.ok(objectPaths.length > 0);
    const downloading = page.waitForEvent('download');
    await page.click('#export');
    const saved = await downloading;
    const exported = JSON.parse(await readFile(await saved.path(), 'utf8'));
    assert.equal(exported.root, report.root);
    assert.equal(exported.outcome, 'ended');
    assert.ok(!JSON.stringify(exported).includes('\"key\"'));
    assert.equal(typeof exported.implementation.sha, 'string');
    assert.ok(!(await page.locator('#audio').getAttribute('src')), 'Ended playback must release its source');
    // Start and explicitly stop before the end: the miniature-player contract.
    await page.click('#play');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent || '{}').outcome === 'playing');
    await page.click('#stop');
    assert.equal(await page.locator('#audio').evaluate(audio => audio.paused), true);
    assert.ok(!(await page.locator('#audio').getAttribute('src')));
    // The browser cannot silently reach a gateway when native lookup is missing.
    objectPaths.length = 0;
    await page.selectOption('#transport', 'native');
    await page.click('#play');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent || '{}').outcome === 'failed', {}, { timeout: 50_000 });
    const native = JSON.parse(await page.locator('#report').textContent());
    assert.equal(native.transport, 'native-preimage');
    assert.equal(native.insideHost, false);
    assert.equal(objectPaths.length, 0, 'Native failure must never call the local block reader');
    await page.selectOption('#transport', 'rpc');
    await page.click('#play');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent || '{}').outcome === 'failed');
    const rpc = JSON.parse(await page.locator('#report').textContent());
    assert.equal(rpc.transport, 'native-chain-rpc');
    assert.equal(rpc.insideHost, false);
    assert.equal(objectPaths.length, 0, 'RPC mode cannot fall back to the local reader');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server?.close();
    await rm(parent, { recursive: true, force: true });
  }
});

test('addressing control verifies five cases, exports evidence, and native mode never falls back', { timeout: 40000 }, async () => {
  const parent = await mkdtemp(join(tmpdir(), 'dotify-marker-browser-'));
  let server, browser;
  try {
    const dir = join(parent, 'marker');
    await prepare(dir, addressingFixture);
    server = await serveFixture(dir);
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [], blocks = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.url().includes('/canary/block/')) blocks.push(r.url()); });
    await page.goto(`${ORIGIN}/addressing.html`);
    assert.equal((await page.request.get(`${ORIGIN}/canary/session`)).status(), 404);
    await page.selectOption('#transport', 'local');
    await page.click('#start');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent || '{}').outcome === 'completed');
    const report = JSON.parse(await page.locator('#report').textContent());
    assert.equal(report.cases.length, 5);
    assert.ok(report.cases.every(c => c.outcome === 'verified'), JSON.stringify(report));
    assert.equal(blocks.length, 7);
    const downloading = page.waitForEvent('download');
    await page.click('#export');
    const exported = JSON.parse(await readFile(await (await downloading).path(), 'utf8'));
    assert.deepEqual(exported, report);
    assert.ok(!JSON.stringify(exported).includes('"key"'));
    blocks.length = 0;
    await page.selectOption('#transport', 'native');
    await page.click('#start');
    await page.waitForFunction(() => JSON.parse(document.querySelector('#report').textContent || '{}').outcome === 'failed');
    const native = JSON.parse(await page.locator('#report').textContent());
    assert.equal(native.insideHost, false);
    assert.equal(native.cases.length, 0);
    assert.equal(blocks.length, 0);
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await server?.close(); await rm(parent, { recursive: true, force: true }); }
});
