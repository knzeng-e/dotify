import { expect, test } from '@playwright/test';
import type { TransactionFeedback } from '../src/shared/types';

declare global {
  interface Window {
    publicationFeedbackTest: (feedback: TransactionFeedback) => void;
  }
}

test('publication progress can close, reopen, and report failure after being reduced', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const path = '/e2e/fixtures/publication-feedback.tsx';
    const harness = await import(/* @vite-ignore */ path);
    window.publicationFeedbackTest = harness.mountPublicationFeedback();
  });
  const pending: TransactionFeedback = {
    operationId: 'publication:test',
    operationKind: 'publication',
    tone: 'pending',
    title: 'Preparing your music',
    message: 'Preparing streaming audio'
  };
  await expect(async () => {
    await page.evaluate(feedback => window.publicationFeedbackTest(feedback), pending);
    await expect(page.getByRole('dialog', { name: 'Preparing your music' })).toBeVisible();
  }).toPass();
  await expect(page.getByRole('dialog')).toContainText('keep the app open');
  await expect(page.getByRole('dialog')).not.toContainText('payment');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const resume = page.getByRole('button', { name: 'View publication status: Preparing your music' });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(feedback => window.publicationFeedbackTest(feedback), {
    ...pending,
    tone: 'error',
    title: 'Publication needs attention',
    message: 'Your prepared music is saved.'
  });
  await expect(page.getByRole('dialog', { name: 'Publication needs attention' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a narrow screen keeps refill amounts, copy and manual details accessible', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await expect(async () => {
    await page.evaluate(async () => {
      const harnessPath = '/e2e/fixtures/publication-feedback.tsx';
      const capacityPath = '/src/features/uploads/publicationCapacity.ts';
      if (!window.publicationFeedbackTest) {
        const harness = await import(/* @vite-ignore */ harnessPath);
        window.publicationFeedbackTest = harness.mountPublicationFeedback();
      }
      const { PublicationCapacityError, publicationCapacityFeedback } = await import(/* @vite-ignore */ capacityPath);
      const capacity = new PublicationCapacityError({
        kind: 'bulletin-quota',
        account: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        genesis: '0x' + 'ab'.repeat(32),
        transactions: 3,
        storageBytes: '0',
        renewalBytes: '256'
      });
      window.publicationFeedbackTest({
        tone: 'error',
        operationKind: 'publication',
        ...publicationCapacityFeedback(capacity, { runtimeAddress: null, contentHash: '' }),
        recoveryAction: { label: 'Check capacity and retry', run: () => document.body.setAttribute('data-refill-retry', 'confirmed') }
      });
    });
    await expect(page.getByRole('dialog', { name: 'Bulletin storage needs a refill' })).toBeVisible();
  }).toPass();
  const dialog = page.getByRole('dialog', { name: 'Bulletin storage needs a refill' });
  await expect(dialog.getByText('Extra transactions', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Extra renewal bytes', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Extra storage bytes', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Copy Bulletin refill request' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Extra transactions: 3');
  expect(copied).toContain('Extra renewal bytes: 256');
  await dialog.getByText('Technical details', { exact: true }).click();
  await expect(dialog.getByText('Bulletin network genesis', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Check capacity and retry' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-refill-retry', 'confirmed');
});
