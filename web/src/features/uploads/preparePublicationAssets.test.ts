import { expect, it, vi } from 'vitest';
import { preparePublicationAssets } from './preparePublicationAssets';

it('does not open the cover connection while backend audio occupies the writer', async () => {
  let release!: (value: string) => void;
  const audio = new Promise<string>(resolve => {
    release = resolve;
  });
  const cover = vi.fn(async () => 'cover');
  const work = preparePublicationAssets({ serial: true, audio: () => audio, cover });
  await Promise.resolve();
  expect(cover).not.toHaveBeenCalled();
  release('ready-audio');
  await expect(work).resolves.toEqual(['ready-audio', 'cover']);
  expect(cover).toHaveBeenCalledOnce();
});

it('does not upload a cover if audio hands back its pending job', async () => {
  const cover = vi.fn();
  await expect(
    preparePublicationAssets({
      serial: true,
      audio: async () => {
        throw new Error('pending');
      },
      cover
    })
  ).rejects.toThrow('pending');
  expect(cover).not.toHaveBeenCalled();
});

it('preserves independent parallel demo preparation', async () => {
  let release!: (value: string) => void;
  const audio = new Promise<string>(resolve => {
    release = resolve;
  });
  const cover = vi.fn(async () => 'cover');
  const work = preparePublicationAssets({ serial: false, audio: () => audio, cover });
  expect(cover).toHaveBeenCalledOnce();
  release('audio');
  await expect(work).resolves.toEqual(['audio', 'cover']);
});
