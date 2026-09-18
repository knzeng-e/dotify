import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { createResponsiveCover } from './coverVariants.js';

describe('responsive cover variants', () => {
  it('creates bounded square WebP assets and preserves the original', async () => {
    const original = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: { r: 210, g: 40, b: 90 } }
    })
      .png()
      .toBuffer();

    const cover = await createResponsiveCover(original, 'png');

    assert.equal(cover.primaryPath, 'cover/640.webp');
    assert.equal(cover.placeholderPath, 'cover/placeholder.webp');
    assert.deepEqual(
      cover.files.map(file => file.path),
      ['cover/placeholder.webp', 'cover/64.webp', 'cover/160.webp', 'cover/320.webp', 'cover/640.webp', 'cover/original.png']
    );

    for (const width of [64, 160, 320, 640]) {
      const file = cover.files.find(candidate => candidate.path === `cover/${width}.webp`);
      assert.ok(file);
      const metadata = await sharp(file.bytes).metadata();
      assert.equal(metadata.width, width);
      assert.equal(metadata.height, width);
      assert.equal(metadata.format, 'webp');
    }

    const placeholder = cover.files.find(file => file.path === cover.placeholderPath);
    assert.ok(placeholder);
    const placeholderMetadata = await sharp(placeholder.bytes).metadata();
    assert.equal(placeholderMetadata.width, 24);
    assert.equal(placeholderMetadata.height, 24);
    assert.deepEqual(Buffer.from(cover.files.at(-1)?.bytes ?? []), original);
  });

  it('rejects bytes that only resemble an image signature', async () => {
    await assert.rejects(() => createResponsiveCover(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'png'));
  });

  it('releases the process-wide image slot after a failed decode', async () => {
    const valid = await sharp({
      create: { width: 80, height: 120, channels: 3, background: { r: 20, g: 120, b: 180 } }
    })
      .png()
      .toBuffer();

    const [invalidResult, validResult] = await Promise.allSettled([
      createResponsiveCover(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'png'),
      createResponsiveCover(valid, 'png')
    ]);

    assert.equal(invalidResult.status, 'rejected');
    assert.equal(validResult.status, 'fulfilled');
    if (validResult.status === 'fulfilled') {
      const primary = validResult.value.files.find(file => file.path === 'cover/640.webp');
      assert.ok(primary);
      assert.ok(primary.bytes.length > 0);
    }
  });
});
