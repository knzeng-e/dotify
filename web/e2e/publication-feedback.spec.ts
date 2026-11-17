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
