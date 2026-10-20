import { expect, test, type Locator, type Page } from '@playwright/test';

// Bounded visual/reflow evidence across small, large, landscape and enlarged
// text layouts. Viewport events simulate keyboard occlusion; a native keyboard
// on an actual iPhone/Product Host remains a separate acceptance check.
const layouts = [
  { name: 'compact', width: 320, height: 640, keyboardHeight: 300, enlargedText: false },
  { name: 'large', width: 430, height: 932, keyboardHeight: 460, enlargedText: false },
  { name: 'landscape', width: 740, height: 390, keyboardHeight: 220, enlargedText: false },
  { name: 'large text with reduced motion', width: 390, height: 844, keyboardHeight: 440, enlargedText: true }
] as const;

async function installViewport(page: Page) {
  await page.addInitScript(() => {
    const viewport = window.visualViewport;
    if (!viewport) throw new Error('VisualViewport is required by this layout fixture');
    let height = window.innerHeight;
    Object.defineProperty(viewport, 'height', { configurable: true, get: () => height });
    Reflect.set(window, '__setFormLayoutHeight', (next: number) => {
      height = next;
      viewport.dispatchEvent(new Event('resize'));
    });
  });
}

async function expectReadableField(field: Locator, visibleBottom: number) {
  await expect(field).toBeFocused();
  await expect
    .poll(async () =>
      field.evaluate((element, bottom) => {
        const rect = element.getBoundingClientRect();
        const label = (element as HTMLInputElement | HTMLTextAreaElement).labels?.[0]?.getBoundingClientRect();
        return !!label && label.top >= 8 && label.bottom <= bottom - 8 && rect.top >= 8 && rect.bottom <= bottom - 8;
      }, visibleBottom)
    )
    .toBe(true);
}

async function expectNoHorizontalOverflow(page: Page, dialog: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
}

for (const layout of layouts) {
  test(`form keyboard layout: ${layout.name} ${layout.width}×${layout.height}`, async ({ page }, info) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    if (layout.enlargedText) await page.emulateMedia({ reducedMotion: 'reduce' });
    await installViewport(page);
    await page.goto('/?e2eRoom=public');
    if (layout.enlargedText) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.getByRole('button', { name: 'Open a room', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Open a room', exact: true });
    await dialog.getByRole('button', { name: 'Select E2E Public Room Track', exact: true }).click();
    await dialog.evaluate(element => {
      element.scrollTop = 0;
    });
    await page.screenshot({ path: info.outputPath('room-sheet.png'), animations: 'disabled' });
    await dialog.getByLabel('Your name or nickname', { exact: true }).fill('Nia');
    await dialog.locator('.room-profile-optional > summary').click();
    const name = dialog.getByLabel('Room name', { exact: false });
    const invitation = dialog.getByLabel('A short invitation', { exact: false });
    await name.fill('Escale à Libreville');
    await expectReadableField(name, layout.height);
    await invitation.fill('Un morceau, une rencontre. Bienvenue dans la salle.');
    await expectReadableField(invitation, layout.height);
    await expectNoHorizontalOverflow(page, dialog);
    await page.screenshot({ path: info.outputPath('room-form-resting.png'), animations: 'disabled' });

    await page.evaluate(height => Reflect.get(window, '__setFormLayoutHeight')(height), layout.keyboardHeight);
    await expectReadableField(invitation, layout.keyboardHeight);
    await expectNoHorizontalOverflow(page, dialog);
    await page.screenshot({ path: info.outputPath('room-form-keyboard.png'), animations: 'disabled' });

    // A user can finish editing and reach the action inside the reduced sheet.
    // Trial click checks reachability/hit testing without opening a real room.
    await invitation.evaluate(element => (element as HTMLTextAreaElement).blur());
    const open = dialog.getByRole('button', { name: 'Open the room', exact: true });
    await expect(open).toBeEnabled();
    await open.scrollIntoViewIfNeeded();
    await open.click({ trial: true });
    const actionBox = (await open.boundingBox())!;
    expect(actionBox.x).toBeGreaterThanOrEqual(0);
    expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(layout.width);
    expect(actionBox.y).toBeGreaterThanOrEqual(0);
    expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(layout.keyboardHeight);
    await expect(name).toHaveValue('Escale à Libreville');
    await expect(invitation).toHaveValue('Un morceau, une rencontre. Bienvenue dans la salle.');
    await page.evaluate(height => Reflect.get(window, '__setFormLayoutHeight')(height), layout.height);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}
