import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { syntheticWav } from './fixtures/syntheticWav';
const fixture = JSON.parse(readFileSync(process.env.DOTIFY_STREAMING_FIXTURE_PATH ?? path.join(process.cwd(), '.data/streaming-fixture.json'), 'utf8')) as {
  keyHex: string;
  scope: { chainId: number; runtimeAddress: string; contentHash: string; keyVersion: string };
  manifest: string;
  files: Record<string, string>;
};
type Fault =
  | 'none'
  | 'relay'
  | 'retry'
  | 'truncated'
  | 'slow'
  | 'held'
  | 'corrupt'
  | 'failed'
  | 'failed-startup'
  | 'denied'
  | 'key-retry'
  | 'held-startup'
  | 'held-next-startup'
  | 'access-stall';
async function setup(
  page: Page,
  fault: Fault = 'none',
  blob = false,
  continuous = false,
  plainPolicy?: { mode: 'classic' | 'human-free' | 'free'; initiallySeed?: boolean; encryptedOnPolicy?: boolean }
) {
  const requests: string[] = [];
  let attempts = 0,
    keyRequests = 0;
  let access: boolean | 'unavailable' = true,
    accessReads = 0,
    plainRequests = 0;
  let freeAccess = fault !== 'denied';
  let release = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.addInitScript(
    ({ scope, blob, plainPolicy }) => {
      Reflect.set(window, '__STREAMING_SCOPE__', scope);
      Reflect.set(window, '__plainPolicy', plainPolicy?.mode);
      Reflect.set(window, '__plainSeedCandidate', plainPolicy?.initiallySeed ?? false);
      Reflect.set(window, '__encryptedOnPolicy', plainPolicy?.encryptedOnPolicy ?? false);
      if (blob) Object.defineProperty(window, 'MediaSource', { value: undefined });
    },
    { scope: fixture.scope, blob, plainPolicy }
  );
  await page.route('**/*', async route => {
    const request = route.request(),
      url = request.url();
    if (url === 'http://media.audio.test/unencrypted-policy.wav') {
      plainRequests++;
      return route.fulfill({ body: syntheticWav(), contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.endsWith('/free-key')) {
      keyRequests++;
      if (fault === 'key-retry' && keyRequests === 1) return route.fulfill({ status: 503, json: { error: 'Temporarily unavailable' } });
      return route.fulfill({
        json: !freeAccess
          ? { access: 'denied', reason: 'ACCESS_DENIED', message: 'Unavailable', hostAction: { type: 'none', label: '' } }
          : { access: 'allowed', playbackMode: 'full', contentKey: `0x${fixture.keyHex}`, runtime: fixture.scope.runtimeAddress }
      });
    }
    if (url.startsWith('http://rpc.audio.test')) {
      const rpc = request.postDataJSON();
      if (rpc.method === 'eth_call') {
        accessReads++;
        if (fault === 'access-stall') await gate;
        if (access === 'unavailable') return route.fulfill({ json: { jsonrpc: '2.0', id: rpc.id, error: { code: -32000, message: 'Runtime unavailable' } } });
      }
      return route.fulfill({ json: { jsonrpc: '2.0', id: rpc.id, result: rpc.method === 'eth_call' ? `0x${'0'.repeat(63)}${access ? 1 : 0}` : '0x190f1b41' } });
    }
    const match = /\/(?:ipfs|api\/media)\/Qm([ab])\1{43}\/(?:stream\/)?(.+)$/.exec(url);
    if (match) {
      const [, name, object] = match;
      requests.push(`${name}:${object}`);
      expect(request.headers().range).toBeUndefined();
      expect(object).not.toContain('archive');
      const value = object === 'manifest.json' ? fixture.manifest : fixture.files[object];
      if (!value) return route.fulfill({ status: 404 });
      if (fault === 'relay' && !url.includes('/api/media/')) return route.fulfill({ status: 503 });
      if (((fault === 'held-startup' && name === 'a') || (fault === 'held-next-startup' && name === 'b')) && object === '96/segment-000.bin') await gate;
      if (name === 'a' && object === '96/segment-001.bin') {
        attempts++;
        if (fault === 'held') await gate;
        if (fault === 'slow') await new Promise(resolve => setTimeout(resolve, 6000));
        if (fault === 'failed' || (fault === 'retry' && attempts === 1)) return route.fulfill({ status: 503 });
      }
      if (name === 'a' && fault === 'failed-startup' && object === 'manifest.json') return route.fulfill({ status: 503 });
      const body = Buffer.from(value, 'base64');
      if (name === 'a' && fault === 'corrupt' && object === '96/segment-001.bin') body[0] ^= 1;
      if (name === 'a' && fault === 'truncated' && object === '96/segment-001.bin' && attempts === 1)
        return route.fulfill({ body: body.subarray(0, body.length - 10), headers: { 'access-control-allow-origin': '*' } });
      return route.fulfill({ body, headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' } });
    }
    if (url.startsWith('http://127.0.0.1:5286') || url.startsWith('blob:')) return route.continue();
    return route.fulfill({ status: 503, body: 'No live network in synthetic regression tests' });
  });
  await page.goto('/e2e/fixtures/audio-continuity.html' + (continuous ? '?continuous=1' : ''));
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  return {
    requests,
    attempts: () => attempts,
    keyRequests: () => keyRequests,
    release,
    accessReads: () => accessReads,
    plainRequests: () => plainRequests,
    setFreeAccess: (value: boolean) => {
      freeAccess = value;
    },
    setAccess: (value: boolean | 'unavailable') => {
      access = value;
    }
  };
}
const audio = (page: Page) => page.locator('audio').first();
const time = (page: Page) => audio(page).evaluate(element => element.currentTime);
async function installAudioProbe(page: Page) {
  await page.addInitScript(() => {
    const created: HTMLAudioElement[] = [];
    Reflect.set(window, '__createdAudio', created);
    window.Audio = new Proxy(Audio, {
      construct(target, args) {
        const audio = Reflect.construct(target, args) as HTMLAudioElement;
        created.push(audio);
        return audio;
      }
    });
  });
}
async function playing(page: Page, minimum = 0.2) {
  await expect.poll(() => time(page)).toBeGreaterThan(minimum);
  await expect(audio(page)).toHaveJSProperty('paused', false);
}
for (const fault of ['retry', 'truncated', 'relay'] as const)
  test(`${fault}: current streaming retries transport without replacing the player`, async ({ page }) => {
    const probe = await setup(page, fault);
    await playing(page);
    if (fault !== 'relay') await expect.poll(probe.attempts).toBe(2);
    await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
    expect(probe.keyRequests()).toBe(1);
    expect(probe.requests.every(item => /manifest.json|(?:96|160|320)\//.test(item))).toBe(true);
  });
test('pause during an outstanding segment stays paused when transport resumes', async ({ page }) => {
  const probe = await setup(page, 'held');
  await playing(page);
  await expect.poll(probe.attempts).toBe(1);
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  const position = await time(page);
  probe.release();
  await page.waitForTimeout(400);
  await expect(audio(page)).toHaveJSProperty('paused', true);
  expect(await time(page)).toBeCloseTo(position, 1);
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  await playing(page, position + 0.2);
});
test('reselect and A to B to A create fresh authenticated streams', async ({ page }) => {
  await setup(page);
  await playing(page);
  for (const name of ['a', 'b', 'a']) {
    await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
    await playing(page);
    await expect(audio(page)).toHaveJSProperty('error', null);
  }
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '4');
});
test('a slow segment buffers and resumes without resetting the media clock', async ({ page }) => {
  await setup(page, 'slow');
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'buffering');
  expect(await time(page)).toBeGreaterThan(3);
  await playing(page, 4.1);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
});
test('changing track cancels an outstanding read without overwriting the new selection', async ({ page }) => {
  const probe = await setup(page, 'held');
  await playing(page);
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
  probe.release();
  await page.waitForTimeout(200);
  await expect(page.getByTestId('state')).toHaveAttribute('data-track', /:b$/);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
});
for (const blob of [false, true])
  test(`authentication failure is terminal, without another key or archival fallback (Blob=${blob})`, async ({ page }) => {
    const probe = await setup(page, 'corrupt', blob);
    if (blob) {
      await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
      await expect(page.getByTestId('state')).toHaveAttribute('data-failure', /.+/);
      await expect(audio(page)).toHaveJSProperty('paused', true);
    } else await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'no-audio');
    expect(probe.attempts()).toBe(1);
    expect(probe.keyRequests()).toBe(1);
  });
test('a denied key never starts playback or downloads media', async ({ page }) => {
  const probe = await setup(page, 'denied');
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  await expect(audio(page)).toHaveJSProperty('paused', true);
  expect(probe.requests).toHaveLength(0);
});
test('exhausted segment readers end the loading state and another track can play', async ({ page }) => {
  await setup(page, 'failed');
  await expect(page.getByTestId('state')).toHaveAttribute('data-status', 'no-audio');
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
});
test('failure before metadata settles pending and permits a new selection', async ({ page }) => {
  await setup(page, 'failed-startup');
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', /.+/);
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
});
test('a temporary key failure recovers without refresh and anonymous reselect checks access again', async ({ page }) => {
  const probe = await setup(page, 'key-retry');
  // One transient failure, then the existing quiet retry starts real audio.
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  expect(probe.keyRequests()).toBe(2);
  // This visitor has no signed session/prepared grant. A new selection must
  // recheck Free access instead of reusing the retired indefinite key map.
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
  await playing(page);
  expect(probe.keyRequests()).toBe(3);
});
test('Free playback reaches the authorized key service without waiting for a client chain read', async ({ page }) => {
  const probe = await setup(page, 'access-stall');
  try {
    await expect.poll(probe.keyRequests).toBe(1);
    await playing(page);
    expect(probe.accessReads()).toBe(0);
    await expect(page.getByTestId('state')).toHaveAttribute('data-access', 'true');
  } finally {
    probe.release();
  }
});

test('cached compatibility audio cannot bypass a new Free-key denial', async ({ page }) => {
  const probe = await setup(page, 'none', true);
  await playing(page);
  const mediaReads = () => probe.requests.filter(request => request.startsWith('a:')).length;
  const downloaded = mediaReads();
  probe.setFreeAccess(false);
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  await expect(page.getByTestId('state')).toHaveAttribute('data-access', 'false');
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', 'access-not-confirmed');
  await expect(audio(page)).toHaveJSProperty('paused', true);
  const deniedRequests = probe.keyRequests();
  expect(deniedRequests).toBeGreaterThan(1);
  expect(mediaReads()).toBe(downloaded);
  probe.setFreeAccess(true);
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  await playing(page);
  expect(probe.keyRequests()).toBe(deniedRequests + 1);
  expect(mediaReads()).toBe(downloaded);
});

test('a fresh mobile source explicitly starts loading instead of relying on implicit preload', async ({ page }) => {
  await page.addInitScript(() => {
    window.Audio = new Proxy(Audio, {
      construct(target, args) {
        const element = Reflect.construct(target, args) as HTMLAudioElement;
        element.preload = 'none';
        return element;
      }
    });
  });
  await setup(page, 'none', true);
  await playing(page);
});

async function requireNativePlayGesture(page: Page, releaseOnPlay: boolean) {
  await page.addInitScript(releaseOnPlay => {
    Reflect.set(window, '__holdNativeLoad', true);
    window.Audio = new Proxy(Audio, {
      construct(target, args) {
        const element = Reflect.construct(target, args) as HTMLAudioElement;
        if (Reflect.get(window, '__holdNativeLoad')) {
          // Chromium may ignore preload=none for Blobs. Defer actual resource
          // selection too, so this Host restriction is deterministic in either
          // engine while playback/decoding after the gesture remain native.
          const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')!;
          const play = element.play.bind(element);
          let pendingSource = '';
          Object.defineProperty(element, 'src', {
            get: () => pendingSource,
            set: (value: string) => {
              pendingSource = value;
            }
          });
          element.load = () => {};
          element.play = () => {
            if (!releaseOnPlay) return new Promise(() => {});
            if (src.get!.call(element) !== pendingSource) src.set!.call(element, pendingSource);
            return play();
          };
        }
        return element;
      }
    });
  }, releaseOnPlay);
}

test('a mobile engine that requires Play before metadata does not trap the transport', async ({ page }) => {
  await requireNativePlayGesture(page, true);
  await setup(page, 'none', true);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'true');
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
});

test('pending native Play displays Pause and can be cancelled before canplay', async ({ page }) => {
  await requireNativePlayGesture(page, true);
  const probe = await setup(page, 'held-startup');
  try {
    await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(audio(page)).toHaveJSProperty('paused', false);
    await expect.poll(() => probe.requests.includes('a:96/segment-000.bin')).toBe(true);
    await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'true');
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    await expect(page.getByTestId('state')).toHaveAttribute('data-time', '0');
    await expect(page.getByRole('slider', { name: 'Seek', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(audio(page)).toHaveJSProperty('paused', true);
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    probe.release();
    await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
    await expect(audio(page)).toHaveJSProperty('paused', true);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await playing(page);
  } finally {
    probe.release();
  }
});

test('a new pending source does not inherit Pause from the previously playing track', async ({ page }) => {
  await requireNativePlayGesture(page, true);
  const probe = await setup(page, 'held-next-startup');
  try {
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await playing(page);
    await page.getByRole('button', { name: 'Select b', exact: true }).click();
    await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '2');
    await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'true');
    await expect(audio(page)).toHaveJSProperty('paused', true);
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
    await expect(page.getByRole('slider', { name: 'Seek', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    probe.release();
    await playing(page);
  } finally {
    probe.release();
  }
});

test('a silent native startup expires with retry and cannot revive after its deadline', async ({ page }) => {
  await page.clock.install();
  await requireNativePlayGesture(page, false);
  await setup(page, 'none', true);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
  await page.clock.fastForward(60_001);
  await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', 'audio-unavailable');
  expect(await audio(page).getAttribute('src')).toBeNull();
  await page.evaluate(() => Reflect.set(window, '__holdNativeLoad', false));
  await page.getByRole('button', { name: 'Select a', exact: true }).click();
  await playing(page);
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', '');
});

test('an expired startup deadline cannot clear a newer paused selection', async ({ page }) => {
  await page.clock.install();
  await setup(page, 'none', true);
  await playing(page);
  await page.getByRole('button', { name: 'Select b', exact: true }).click();
  await playing(page);
  await page.getByRole('button', { name: 'Toggle playback' }).click();
  await expect(audio(page)).toHaveJSProperty('paused', true);
  await page.clock.fastForward(60_001);
  await expect(page.getByTestId('state')).toHaveAttribute('data-track', /:b$/);
  await expect(page.getByTestId('state')).toHaveAttribute('data-failure', '');
  await expect(audio(page)).toHaveJSProperty('paused', true);
  expect(await audio(page).getAttribute('src')).toMatch(/^blob:/);
});

test('hosts without MSE retry ciphertext objects and play the same authenticated AAC rendition', async ({ page }) => {
  const probe = await setup(page, 'retry', true);
  await playing(page);
  expect(probe.attempts()).toBe(2);
  await expect(page.getByTestId('state')).toHaveAttribute('data-generation', '1');
});

for (const changePurpose of [false, true])
  test(
    changePurpose
      ? 'a changed playback purpose rejects the prepared source and authorizes again'
      : 'an authorized silent next source is adopted at the boundary without another key or download',
    async ({ page }) => {
      await installAudioProbe(page);
      const probe = await setup(page, 'none', false, true);
      await playing(page);
      await audio(page).evaluate(element => {
        element.currentTime = 11;
      });
      await expect.poll(() => probe.requests.some(path => path === 'b:96/segment-001.bin')).toBe(true);
      await expect.poll(probe.keyRequests).toBe(2);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const prepared = (Reflect.get(window, '__createdAudio') as HTMLAudioElement[]).find(
              audio => !audio.isConnected && audio.src && audio.readyState >= 3
            );
            Reflect.set(window, '__expectedWarmAudio', prepared);
            return Boolean(prepared);
          })
        )
        .toBe(true);
      if (changePurpose) await page.evaluate(() => Reflect.set(window, '__selectForRoom', true));
      await page.evaluate(() => {
        const sample = { ended: 0, playing: 0 };
        Reflect.set(window, '__warmBoundary', sample);
        document.querySelector('audio')!.addEventListener(
          'ended',
          () => {
            sample.ended = performance.now();
          },
          { once: true }
        );
        document.addEventListener(
          'playing',
          event => {
            if (sample.ended && event.target === document.querySelector('audio')) sample.playing = performance.now();
          },
          true
        );
      });
      await expect(page.getByTestId('state')).toHaveAttribute('data-track', /:b$/, { timeout: 20000 });
      await expect(audio(page)).toHaveJSProperty('paused', false);
      await expect.poll(() => page.evaluate(() => (Reflect.get(window, '__warmBoundary') as { playing: number }).playing)).toBeGreaterThan(0);
      const gap = await page.evaluate(() => {
        const value = Reflect.get(window, '__warmBoundary') as { ended: number; playing: number };
        return value.playing - value.ended;
      });
      expect(gap).toBeGreaterThanOrEqual(0);
      if (!changePurpose) expect(gap).toBeLessThan(300);
      expect(await page.evaluate(() => document.querySelector('audio') === Reflect.get(window, '__expectedWarmAudio'))).toBe(!changePurpose);
      expect(probe.keyRequests()).toBe(changePurpose ? 3 : 2);
      await expect(audio(page)).toHaveJSProperty('error', null);
    }
  );

for (const scenario of [
  { mode: 'classic', access: false },
  { mode: 'human-free', access: false },
  { mode: 'classic', access: true },
  { mode: 'classic', access: 'unavailable' }
] as const) {
  test(`unencrypted ${scenario.mode} keeps policy checks when access is ${scenario.access}`, async ({ page }) => {
    await installAudioProbe(page);
    const probe = await setup(page, 'none', false, true, { mode: scenario.mode });
    await playing(page);
    probe.setAccess(scenario.access);
    await audio(page).evaluate(element => {
      element.currentTime = 11;
    });
    await expect(page.getByTestId('state')).toHaveAttribute('data-preparations', '1');
    // Preparation must not attach even a paused source for a policy-managed URL.
    expect(
      await page.evaluate(() => (Reflect.get(window, '__createdAudio') as HTMLAudioElement[]).some(element => element.src.includes('unencrypted-policy.wav')))
    ).toBe(false);
    expect(probe.plainRequests()).toBe(0);
    const readsBeforeSelection = probe.accessReads();
    await page.getByRole('button', { name: 'Select b', exact: true }).click();
    await expect(page.getByTestId('state')).toHaveAttribute('data-track', /:b$/);
    await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
    await expect(page.getByTestId('state')).toHaveAttribute('data-access', String(scenario.access === true));
    expect(probe.accessReads()).toBeGreaterThan(readsBeforeSelection);
    if (scenario.access === true) {
      await playing(page);
      expect(probe.plainRequests()).toBeGreaterThan(0);
    } else {
      await expect(audio(page)).toHaveJSProperty('paused', true);
      expect(probe.plainRequests()).toBe(0);
    }
    expect(probe.keyRequests()).toBe(1);
  });
}

for (const encryptedOnPolicy of [false, true])
  test(`a ready local candidate cannot bypass a newly applied artist policy (encrypted=${encryptedOnPolicy})`, async ({ page }) => {
    await installAudioProbe(page);
    const probe = await setup(page, 'none', false, true, { mode: encryptedOnPolicy ? 'free' : 'classic', initiallySeed: true, encryptedOnPolicy });
    await playing(page);
    probe.setAccess(false);
    if (encryptedOnPolicy) probe.setFreeAccess(false);
    await audio(page).evaluate(element => {
      element.currentTime = 11;
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          (Reflect.get(window, '__createdAudio') as HTMLAudioElement[]).some(
            element => !element.isConnected && element.src.includes('unencrypted-policy.wav') && element.readyState >= 3
          )
        )
      )
      .toBe(true);
    const readsBeforeSelection = probe.accessReads();
    await page.getByRole('button', { name: 'Apply artist policy to b', exact: true }).click();
    await page.getByRole('button', { name: 'Select b', exact: true }).click();
    await expect(page.getByTestId('state')).toHaveAttribute('data-track', /:b$/);
    await expect(page.getByTestId('state')).toHaveAttribute('data-pending', 'false');
    await expect(page.getByTestId('state')).toHaveAttribute('data-access', 'false');
    if (encryptedOnPolicy) expect(probe.accessReads()).toBe(readsBeforeSelection);
    else expect(probe.accessReads()).toBeGreaterThan(readsBeforeSelection);
    await expect(audio(page)).toHaveJSProperty('paused', true);
    expect(
      await page.evaluate(() => (Reflect.get(window, '__createdAudio') as HTMLAudioElement[]).some(element => element.src.includes('unencrypted-policy.wav')))
    ).toBe(false);
  });
