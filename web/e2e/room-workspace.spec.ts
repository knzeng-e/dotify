import { expect, test, type Page } from '@playwright/test';

async function hostRoom(page: Page) {
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  await page.getByRole('button', { name: 'Select E2E Public Room Track' }).click();
  await page.getByLabel('Your name in the room').fill('Room host');
  await page.getByRole('button', { name: 'Open the room', exact: true }).click();
  await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
  return (await page.getByTestId('room-code').innerText()).trim();
}

async function expectConversationFits(page: Page) {
  const bounds = await page.evaluate(() => {
    const player = document.querySelector('.player-stage')!.getBoundingClientRect();
    const composer = document.querySelector('#room-panel-chat .room-chat-form')!.getBoundingClientRect();
    const nav = document.querySelector('.bottom-nav')!.getBoundingClientRect();
    const conversation = document.querySelector('#room-panel-chat .room-chat-list')!.getBoundingClientRect();
    return {
      conversationHeight: conversation.height,
      playerTop: player.top,
      playerBottom: player.bottom,
      playerRight: player.right,
      composerLeft: composer.left,
      composerTop: composer.top,
      composerBottom: composer.bottom,
      bottom: nav.height ? nav.top : innerHeight,
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    };
  });
  expect(bounds.conversationHeight).toBeGreaterThanOrEqual(80);
  expect(bounds.playerTop).toBeGreaterThanOrEqual(0);
  expect(bounds.composerTop >= bounds.playerBottom - 1 || bounds.composerLeft >= bounds.playerRight - 1).toBe(true);
  expect(bounds.playerBottom).toBeLessThanOrEqual(bounds.bottom + 1);
  expect(bounds.composerBottom).toBeLessThanOrEqual(bounds.bottom + 1);
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
}

for (const [width, height] of [
  [320, 568],
  [390, 844],
  [768, 1024],
  [844, 390],
  [1024, 768]
]) {
  test(`room conversation fits ${width}×${height} without losing playback or drafts`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await hostRoom(page);
    await expectConversationFits(page);
    const draft = page.getByRole('textbox', { name: 'Message the room' });
    await draft.fill('Keep this thought');
    await page.getByRole('tab', { name: /Queue/ }).click();
    await page.getByRole('textbox', { name: 'Request a track' }).fill('Something soulful');
    await page.getByRole('tab', { name: /People/ }).click();
    await expect(page.getByRole('button', { name: 'Close room', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Receive room tips', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Chat', exact: true }).click();
    await expect(draft).toHaveValue('Keep this thought');
    await expectConversationFits(page);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('log')).toContainText('Keep this thought');
    await expect(draft).toHaveValue('');
    await page.screenshot({ path: testInfo.outputPath('room-conversation.png') });
    await page.getByRole('tab', { name: /Queue/ }).click();
    await expect(page.getByRole('textbox', { name: 'Request a track' })).toHaveValue('Something soulful');
    await page.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByLabel('Track requests', { exact: true })).toContainText('Something soulful');
    await expect(page.getByRole('textbox', { name: 'Request a track' })).toHaveValue('');
    await page.getByRole('tab', { name: 'Chat', exact: true }).click();
    await page.getByRole('tab', { name: 'Chat', exact: true }).press('ArrowRight');
    await expect(page.getByRole('tab', { name: /Queue/ })).toBeFocused();
  });
}

test('mobile guest chats with a host while the same remote audio stays mounted', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const host = await hostContext.newPage();
    const roomId = await hostRoom(host);
    const guest = await guestContext.newPage();
    await guest.goto(`/#/rooms/${roomId}`);
    await guest.getByRole('textbox', { name: 'Your name in the room' }).fill('Mina');
    await guest.getByRole('button', { name: 'Enter and listen' }).click();
    await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20000 });
    await guest.evaluate(() => {
      (window as unknown as { roomAudio: Element }).roomAudio = document.querySelectorAll('audio.native-player-source')[1];
    });
    await guest.getByRole('textbox', { name: 'Message the room' }).fill('Here with you');
    await guest.getByRole('button', { name: 'Send message' }).click();
    await expect(host.getByRole('log')).toContainText('Here with you');
    const ownMessage = guest.locator(".room-chat-row[data-self='true']").filter({ hasText: 'Here with you' });
    await expect(ownMessage).toBeVisible();
    await expect(ownMessage.locator('.room-chat-you')).toHaveText('You');
    await expect(ownMessage.locator('.room-chat-role')).toHaveCount(0);
    expect(await ownMessage.evaluate(element => getComputedStyle(element).flexDirection)).toBe('row');
    await guest.getByRole('tab', { name: /People/ }).click();
    await expect(guest.locator('.listener-list')).toContainText('Mina');
    await guest.getByRole('tab', { name: 'Chat', exact: true }).click();
    expect(
      await guest.evaluate(() => (window as unknown as { roomAudio: Element }).roomAudio === document.querySelectorAll('audio.native-player-source')[1])
    ).toBe(true);
    await expectConversationFits(guest);
    await guest.getByRole('textbox', { name: 'Message the room' }).fill('A thought during reconnect');
    await guestContext.setOffline(true);
    await expect(guest.getByRole('button', { name: 'Send message' })).toBeDisabled({ timeout: 15000 });
    await expect(guest.locator('.room-header-meta')).not.toContainText(/\d+ here/);
    await expect(guest.getByRole('tab', { name: 'People', exact: true })).toBeVisible();
    await expect(guest.getByRole('textbox', { name: 'Message the room' })).toHaveValue('A thought during reconnect');
    await guestContext.setOffline(false);
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});

for (const [width, height] of [
  [390, 844],
  [1440, 1000]
]) {
  test(`protected room status stays clear of reactions at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await hostRoom(page);
    await page.getByRole('tab', { name: 'Queue', exact: true }).click();
    await page.locator('.host-lineup summary').click();
    await page.getByLabel('Add from the catalog').selectOption({ label: 'E2E Protected Room Track — Dotify Room Host' });
    await page.locator('.host-lineup').getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('.host-lineup')).toContainText('Next');
    await page.getByRole('button', { name: 'Play next' }).click();
    await expect(page.getByTestId('access-warning')).toBeVisible();
    await page.getByRole('button', { name: 'Not now' }).click();
    const status = page.getByTestId('locked-player-state');
    const reactions = page.locator('.room-reaction-dock');
    await expect(status).toBeVisible();
    await expect(reactions.getByRole('button', { name: 'React heart' })).toBeVisible();
    const statusBounds = (await status.boundingBox())!;
    const reactionBounds = (await reactions.boundingBox())!;
    expect(statusBounds.y).toBeGreaterThanOrEqual(reactionBounds.y + reactionBounds.height - 1);
    expect(statusBounds.y + statusBounds.height).toBeLessThanOrEqual(height);
    await expect(page.locator('.host-lineup summary')).toContainText('Nothing queued');
    await expect(page.getByTestId('room-code')).toHaveText(/[A-Z0-9]{4,}/);
    await page.screenshot({ path: testInfo.outputPath(`protected-room-${width}.png`) });
  });
}

test('a host sees one room code and an invite-first state while alone', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => Reflect.set(window, '__sharedRoomInvite', data)
    });
  });
  const roomId = await hostRoom(page);

  await expect(page.getByTestId('room-code')).toHaveCount(1);
  await page.getByRole('tab', { name: /People/ }).click();
  const invite = page.getByLabel('Invite people to this room');
  await expect(invite).toContainText('Bring someone into this track');
  await expect(invite.getByRole('button', { name: 'Copy invite' })).toBeVisible();
  await expect(invite.getByRole('button', { name: 'Show QR' })).toBeVisible();
  await invite.getByRole('button', { name: 'Share', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (Reflect.get(window, '__sharedRoomInvite') as ShareData | undefined)?.url)).toContain(`#/rooms/${roomId}`);
});

test('a room requires a chosen host name instead of presenting a role as identity', async ({ page }) => {
  await page.goto('/?e2eRoom=public');
  await page.getByRole('button', { name: 'Open a room', exact: true }).click();
  const name = page.getByLabel('Your name in the room');
  const open = page.getByRole('button', { name: 'Open the room', exact: true });

  await expect(name).toHaveValue('');
  await expect(open).toBeDisabled();
  await name.fill('Host');
  await expect(open).toBeDisabled();
  await name.fill('Gaby');
  await expect(open).toBeEnabled();
});

test('compact keyboard viewport leaves space to compose and restores after resize', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await hostRoom(page);
  await page.getByRole('textbox', { name: 'Message the room' }).fill('Still listening');
  // Simulate the visual viewport resize event, not a real iOS keyboard.
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 430 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('.app-shell')).toHaveAttribute('data-keyboard-open', 'true');
  const composerBottom = await page.getByRole('textbox', { name: 'Message the room' }).evaluate(element => element.getBoundingClientRect().bottom);
  expect(composerBottom).toBeLessThanOrEqual(430);
  await expect(page.locator('.player-stage')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message the room' })).toHaveValue('Still listening');
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, 'height');
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('.app-shell')).toHaveAttribute('data-keyboard-open', 'false');
  await expectConversationFits(page);
});

test('desktop keeps playback, people and chat visible and returns from artist support', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await hostRoom(page);
  await page.getByRole('textbox', { name: 'Message the room' }).fill('A place to listen together');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('log')).toContainText('A place to listen together');
  await expect(page.getByLabel('People and room controls')).toBeVisible();
  await expectConversationFits(page);
  const stage = (await page.locator('.player-stage').boundingBox())!;
  const reactions = (await page.locator('.room-reaction-dock').boundingBox())!;
  expect(reactions.width).toBeGreaterThanOrEqual(stage.width - 40);
  await page.screenshot({ path: testInfo.outputPath('room-conversation.png') });
  await page.getByRole('button', { name: 'Artist & support', exact: true }).click();
  await expect(page.locator('.player-dock')).toBeVisible();
  await page.getByRole('button', { name: 'Room live', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible();
});

test('room controls fit a small desktop and the QR remains discoverable', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await hostRoom(page);
  await expect(page.getByRole('textbox', { name: 'Message the room' })).toBeVisible();
  await page.getByRole('tab', { name: /People/ }).click();
  await page.getByRole('button', { name: 'Show QR' }).click();
  await expect(page.getByRole('dialog')).toContainText('Scan to join');
  await page.getByRole('button', { name: 'Close projected QR' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const scenario of ['zoomed-chat', 'zoomed-chat-tab', 'resized-requests']) {
  test(`composer remains above the keyboard with ${scenario}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await hostRoom(page);
    if (scenario === 'resized-requests') await page.getByRole('tab', { name: /Queue/ }).click();
    const input = page.getByRole('textbox', { name: scenario.startsWith('zoomed-chat') ? 'Message the room' : 'Request a track', includeHidden: true });
    await input.fill('My words remain visible');
    await expect(page.locator('.bottom-nav')).toBeVisible();
    await page.evaluate(kind => {
      Reflect.set(window, '__originalRoomAudio', document.querySelector('audio'));
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 310 });
      Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, value: 24 });
      Object.defineProperty(window.visualViewport, 'scale', { configurable: true, value: kind.startsWith('zoomed-chat') ? 1.15 : 1 });
      Object.defineProperty(window.visualViewport, 'width', { configurable: true, value: kind.startsWith('zoomed-chat') ? 320 : 390 });
      Object.defineProperty(window.visualViewport, 'offsetLeft', { configurable: true, value: kind.startsWith('zoomed-chat') ? 35 : 0 });
      if (kind === 'resized-requests') Object.defineProperty(window, 'innerHeight', { configurable: true, value: 310 });
      window.visualViewport!.dispatchEvent(new Event('resize'));
    }, scenario);
    await expect(page.locator('.app-shell')).toHaveAttribute('data-keyboard-open', 'true');
    await expect.poll(() => input.evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(334);
    expect(await input.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    await expect(input).toHaveValue('My words remain visible');
    await expect(page.locator('.player-stage')).toBeVisible();
    await expect(page.locator('.player-stage').getByRole('slider')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Repeat this track', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${scenario}.png`) });
    if (scenario === 'zoomed-chat-tab') await page.getByRole('tab', { name: /Queue/ }).click();
    else await page.getByRole('button', { name: 'Finish typing' }).click();
    // WebKit may keep the keyboard geometry after focus has already left.
    await expect(input).not.toBeFocused();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.locator('.app-shell')).toHaveAttribute('data-keyboard-open', 'true');
    const closingBounds = await page.locator('.app-shell').boundingBox();
    expect(closingBounds!.x).toBe(scenario.startsWith('zoomed-chat') ? 35 : 0);
    expect(closingBounds!.width).toBe(scenario.startsWith('zoomed-chat') ? 320 : 390);
    await expect(page.locator('.bottom-nav')).toBeHidden();
    await page.evaluate(() => {
      for (const name of ['height', 'offsetTop', 'scale', 'width', 'offsetLeft']) Reflect.deleteProperty(window.visualViewport!, name);
      // innerHeight is an own Window accessor: deleting it removes the real
      // measurement too. Restore a valid resting height after the simulation.
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
      window.visualViewport!.dispatchEvent(new Event('resize'));
    });
    await expect(page.locator('.bottom-nav')).toBeVisible();
    const restoredBounds = await page.locator('.app-shell').boundingBox();
    expect(restoredBounds!.x).toBe(0);
    expect(restoredBounds!.width).toBe(390);
    await expect(input).toHaveValue('My words remain visible');
    expect(await page.evaluate(() => document.querySelector('audio') === Reflect.get(window, '__originalRoomAudio'))).toBe(true);
  });
}

test('switching panels while typing keeps the tapped tab in place until release', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await hostRoom(page);
  await page.getByRole('textbox', { name: 'Message the room' }).fill('Keep my place');
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 430 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('.app-shell')).toHaveAttribute('data-composing', 'true');
  await expect(page.locator('.bottom-nav')).toBeHidden();
  const requests = page.getByRole('tab', { name: /Queue/ });
  const bounds = await requests.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  // Let the blur-triggered layout update occur before the finger is released.
  await page.waitForTimeout(250);
  const duringPress = await requests.boundingBox();
  await page.mouse.up();
  expect(duringPress!.y).toBeCloseTo(bounds!.y, 0);
  await expect(page.getByRole('textbox', { name: 'Request a track' })).toBeVisible();
});

test('focus waits for keyboard geometry without moving the player or tabs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await hostRoom(page);
  const stage = page.locator('.player-stage');
  const before = await stage.boundingBox();
  await page.getByRole('textbox', { name: 'Message the room' }).focus();
  await page.waitForTimeout(550); // includes every bounded delayed viewport read
  await expect(page.locator('.app-shell')).toHaveAttribute('data-composing', 'false');
  await expect(page.locator('.bottom-nav')).toBeVisible();
  const afterFocus = await stage.boundingBox();
  expect(afterFocus!.y).toBeCloseTo(before!.y, 0);
  expect(afterFocus!.height).toBeCloseTo(before!.height, 0);
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 430 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('.app-shell')).toHaveAttribute('data-composing', 'true');
  // Near-threshold frames during dismissal must not flip between two layouts.
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 740 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('.app-shell')).toHaveAttribute('data-composing', 'true');
  await page.evaluate(() => {
    Reflect.deleteProperty(window.visualViewport!, 'height');
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('.app-shell')).toHaveAttribute('data-composing', 'false');
  const restored = await stage.boundingBox();
  expect(restored!.height).toBeCloseTo(before!.height, 0);
});

test('keyboard restores the original browser inset after dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 644 });
  });
  await hostRoom(page);
  const shell = page.locator('.app-shell');
  await page.getByRole('textbox', { name: 'Message the room' }).fill('Keep my draft');
  await expect(shell).toHaveAttribute('data-composing', 'false');
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 310 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(shell).toHaveAttribute('data-composing', 'true');
  await page.getByRole('button', { name: 'Finish typing' }).click();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 644 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(shell).toHaveAttribute('data-composing', 'false');
  await expect(page.locator('.bottom-nav')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message the room' })).toHaveValue('Keep my draft');
});

test('keyboard rotation preserves browser chrome and relearns the resting viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 644 });
  });
  await hostRoom(page);
  const shell = page.locator('.app-shell');
  const input = page.getByRole('textbox', { name: 'Message the room' });
  await input.fill('Rotate without losing this');
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 310 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(shell).toHaveAttribute('data-composing', 'true');
  // Publish the rotated layout and keyboard geometry atomically, as a single
  // viewport observation. Native orientation/keyboard animation needs device QA.
  await page.evaluate(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 844 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 390 });
    Object.defineProperty(window.visualViewport, 'width', { configurable: true, value: 844 });
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 90 });
    window.dispatchEvent(new Event('resize'));
  });
  await expect(shell).toHaveAttribute('data-composing', 'true');
  await input.evaluate(element => element.blur());
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 310 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(shell).toHaveAttribute('data-composing', 'false');
  await expect(page.locator('.bottom-nav')).toBeVisible();
  await expect(input).toHaveValue('Rotate without losing this');
  // New orientation has an 80px resting inset, rather than the old 200px.
  await input.focus();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 150 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect(shell).toHaveAttribute('data-composing', 'true');
});

test('keyboard transition retains an opaque canvas, player geometry and drafts across transient empty frames', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await hostRoom(page);
  const shell = page.locator('.app-shell');
  const stage = page.locator('.player-stage');
  const before = await stage.boundingBox();
  const transportBefore = (await page.locator('.player-transport').boundingBox())!;
  await page.evaluate(() => Reflect.set(window, '__transitionAudio', document.querySelector('audio')));
  for (const tab of ['Chat', 'Queue']) {
    await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
    const input = page.getByRole('textbox', { name: tab === 'Chat' ? 'Message the room' : 'Request a track' });
    await input.fill(`Draft in ${tab}`);
    for (const height of [0, 500, 0, 310, Number.NaN, 310]) {
      const previous = await shell.boundingBox();
      await page.evaluate(height => {
        Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: height });
        window.visualViewport!.dispatchEvent(new Event('resize'));
        return new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      }, height);
      if (!height || !Number.isFinite(height)) {
        expect((await shell.boundingBox())!.height).toBe(previous!.height);
      } else {
        await expect(shell).toHaveAttribute('data-composing', 'true');
        // Only the secondary reaction strip collapses for the keyboard. The
        // artwork and primary transport retain their dimensions and position.
        await expect(page.locator('.room-reaction-dock')).toBeHidden();
        const keyboardStage = (await stage.boundingBox())!;
        expect(keyboardStage.height).toBeLessThan(before!.height);
        const transportAfter = (await page.locator('.player-transport').boundingBox())!;
        expect(transportAfter.y - keyboardStage.y).toBeCloseTo(transportBefore.y - before!.y, 0);
        expect(transportAfter.height).toBeCloseTo(transportBefore.height, 0);
        const inputBounds = (await input.boundingBox())!;
        expect(inputBounds.y + inputBounds.height).toBeLessThanOrEqual(height);
      }
      const canvas = await page.evaluate(() =>
        [document.documentElement, document.body, document.querySelector('.app-shell')!].map(element => getComputedStyle(element).backgroundColor)
      );
      expect(canvas).toEqual(['rgb(5, 13, 26)', 'rgb(5, 13, 26)', 'rgb(5, 13, 26)']);
      await expect(input).toHaveValue(`Draft in ${tab}`);
    }
    await page.screenshot({ path: testInfo.outputPath(`keyboard-${tab.toLowerCase()}.png`) });
    await page.getByRole('button', { name: 'Finish typing' }).click();
    await page.evaluate(() => {
      Reflect.deleteProperty(window.visualViewport!, 'height');
      window.visualViewport!.dispatchEvent(new Event('resize'));
    });
    await expect(shell).toHaveAttribute('data-composing', 'false');
    await expect(page.locator('.bottom-nav')).toBeVisible();
  }
  expect(await page.evaluate(() => Reflect.get(window, '__transitionAudio') === document.querySelector('audio'))).toBe(true);
  await page.locator('.bottom-nav').getByRole('button', { name: 'Music', exact: true }).click();
  await expect(shell).toHaveAttribute('data-room-focus', 'false');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe('hidden');
});

for (const initialHeight of [0, Number.NaN]) {
  test(`keyboard transition recovers from invalid initial height ${initialHeight} after focus`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(height => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: height });
    }, initialHeight);
    await hostRoom(page);
    const input = page.getByRole('textbox', { name: 'Message the room' });
    await input.fill('The first valid frame can arrive after focus');
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 310 });
      window.visualViewport!.dispatchEvent(new Event('resize'));
    });
    await expect(page.locator('.app-shell')).toHaveAttribute('data-composing', 'true');
    const box = (await input.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(310);
    await page.getByRole('button', { name: 'Finish typing' }).click();
    await page.evaluate(() => {
      Reflect.deleteProperty(window.visualViewport!, 'height');
      window.visualViewport!.dispatchEvent(new Event('resize'));
    });
    await expect(page.locator('.app-shell')).toHaveAttribute('data-composing', 'false');
    await expect(page.locator('.bottom-nav')).toBeVisible();
    await expect(input).toHaveValue('The first valid frame can arrive after focus');
  });
}

test('live reactions reach both participants, stay available in Queue, and do not replay on return', async ({ browser }, testInfo) => {
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const host = await hostContext.newPage();
    const code = await hostRoom(host);
    const guest = await guestContext.newPage();
    guest.setDefaultTimeout(5000);
    await guest.goto(`/#/rooms/${code}`);
    await guest.getByLabel('Your name in the room').fill('Mina');
    await guest.getByRole('button', { name: 'Enter and listen' }).click();
    await expect(guest.getByTestId('room-listener-sync')).toHaveText('In sync', { timeout: 20000 });
    await host.getByRole('textbox', { name: 'Message the room' }).fill('That bassline. Stay for the next track.');
    await host.getByRole('button', { name: 'Send message' }).click();
    await expect(guest.locator('.room-chat-role')).toHaveText('Host');
    await guest.getByRole('textbox', { name: 'Message the room' }).fill('Right here with you.');
    await guest.getByRole('button', { name: 'Send message' }).click();
    await expect(host.getByRole('log')).toContainText('Right here with you.');
    await guest.getByRole('tab', { name: 'Queue', exact: true }).click();
    await guest.getByRole('button', { name: 'React heart', exact: true }).click();
    await expect(host.locator('.room-reaction-activity')).toContainText('Mina');
    await expect(guest.locator('.room-reaction-activity')).toContainText('You');
    await expect(host.locator('.room-reaction-trail > span')).toHaveCount(1);
    await host.screenshot({ path: testInfo.outputPath('desktop-live-chat.png') });
    await guest.getByRole('tab', { name: 'Chat', exact: true }).click();
    await guest.screenshot({ path: testInfo.outputPath('mobile-live-chat.png') });
    await expect(guest.locator('.room-reaction-trail > span')).toHaveCount(0);
    await guest.getByRole('button', { name: 'More reactions' }).click();
    const palette = guest.getByRole('group', { name: 'All reactions', exact: true });
    await expect(palette.getByRole('button', { name: 'React heart', exact: true })).toBeFocused();
    await palette.getByRole('checkbox', { name: 'Animate reactions' }).uncheck();
    await palette.getByRole('button', { name: 'React sparkle' }).click();
    await expect(guest.getByRole('button', { name: 'More reactions' })).toBeFocused();
    await expect(guest.locator('.room-reaction-activity')).toContainText('reacted sparkle');
    await expect(guest.locator('.room-reaction-trail')).toBeHidden();
    await guest.getByRole('button', { name: 'More reactions' }).click();
    await palette.press('Escape');
    await expect(guest.getByRole('button', { name: 'More reactions' })).toBeFocused();
    await guest.locator('.bottom-nav').getByRole('button', { name: 'Music', exact: true }).click();
    await guest.getByRole('button', { name: /^Return to room/ }).click();
    await expect(guest.locator('.room-reaction-trail > span')).toHaveCount(0);
    await guestContext.setOffline(true);
    await expect(guest.getByRole('button', { name: 'React heart', exact: true })).toBeDisabled({ timeout: 15000 });
  } finally {
    await guestContext.close().catch(() => {});
    await hostContext.close().catch(() => {});
  }
});

test('live chat lets readers pause history and catch up after visiting another tab', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext({ viewport: { width: 320, height: 568 } });
  try {
    const host = await hostContext.newPage();
    const code = await hostRoom(host);
    const guest = await guestContext.newPage();
    await guest.goto(`/#/rooms/${code}`);
    await guest.getByLabel('Your name in the room').fill('Mina');
    await guest.getByRole('button', { name: 'Enter and listen' }).click();
    await expect(guest.getByRole('log')).toBeVisible();
    for (let index = 0; index < 7; index++) {
      await host
        .getByRole('textbox', { name: 'Message the room' })
        .fill(`Track ${index}: there is so much to hear in this arrangement. Listen to the percussion.`);
      await host.getByRole('button', { name: 'Send message' }).click();
      await expect(guest.getByRole('log')).toContainText(`Track ${index}:`);
      await host.waitForTimeout(1050); // Respect the real server's 5 messages / 5s limit.
    }
    const log = guest.getByRole('log');
    await log.evaluate(element => {
      element.scrollTop = 0;
      element.dispatchEvent(new Event('scroll'));
    });
    await host.getByRole('textbox', { name: 'Message the room' }).fill('A new thought while you read');
    await host.getByRole('button', { name: 'Send message' }).click();
    await expect(guest.getByRole('button', { name: 'New messages', exact: true })).toBeVisible();
    expect(await log.evaluate(element => element.scrollTop)).toBeLessThan(2);
    await guest.getByRole('tab', { name: 'Queue', exact: true }).click();
    await expect(guest.locator('#room-tab-chat')).toContainText('Chat');
    await expect(guest.locator('.room-chat-unread')).toBeVisible();
    await guest.locator('#room-tab-chat').click();
    await guest.getByRole('button', { name: 'New messages', exact: true }).click();
    await expect(guest.locator('.room-chat-unread')).toHaveCount(0);
    expect(await log.evaluate(element => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(2);
  } finally {
    await guestContext.close();
    await hostContext.close();
  }
});

test('chat preserves IME composition and rejected drafts without automatic resend', async ({ page }) => {
  await hostRoom(page);
  const input = page.getByRole('textbox', { name: 'Message the room' });
  await input.fill('Composing a thought');
  await input.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true, cancelable: true });
  await expect(page.getByRole('log')).not.toContainText('Composing a thought');
  await expect(input).toHaveValue('Composing a thought');
  for (let index = 0; index < 5; index++) {
    await input.fill(`Accepted ${index}`);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(input).toHaveValue('');
  }
  await input.fill('Keep this draft');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.room-chat-connection')).toBeVisible();
  await expect(input).toHaveValue('Keep this draft');
  await page.waitForTimeout(5200);
  await expect(page.getByRole('log')).not.toContainText('Keep this draft');
  await expect(input).toHaveValue('Keep this draft');
});

test('reaction feedback remains readable without motion and picker fits a 320px screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await hostRoom(page);
  await page.getByRole('button', { name: 'React fire', exact: true }).click();
  await expect(page.locator('.room-reaction-activity')).toContainText('You');
  await expect(page.locator('.room-reaction-trail')).toBeHidden();
  await page.getByRole('button', { name: 'More reactions' }).click();
  const picker = page.getByRole('group', { name: 'All reactions', exact: true });
  const bounds = (await picker.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  for (const button of await picker.getByRole('button').all()) {
    const rect = (await button.boundingBox())!;
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: testInfo.outputPath('mobile-reaction-picker.png') });
});
