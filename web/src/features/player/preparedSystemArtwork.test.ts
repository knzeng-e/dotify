import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SystemMediaTrack } from './systemArtwork';

vi.mock('./systemBrandedArtwork', () => ({ drawSystemBrandedArtwork: vi.fn() }));
vi.mock('../../services/publicArtworkCache', async importOriginal => ({
  ...(await importOriginal<typeof import('../../services/publicArtworkCache')>()),
  loadPublicArtwork: vi.fn(async () => 'data:image/png;base64,AA==')
}));

const images: FixtureImage[] = [];
let compositions = 0;
let pngOverride: string | undefined;
class FixtureImage {
  naturalWidth = 640;
  naturalHeight = 640;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  value = '';
  set src(value: string) {
    this.value = value;
    if (value) images.push(this);
  }
  get src() {
    return this.value;
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  images.length = 0;
  compositions = 0;
  pngOverride = undefined;
  vi.stubGlobal('Image', FixtureImage);
  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toDataURL: () => {
        compositions++;
        return pngOverride ?? `data:image/png;base64,${Buffer.from(`frame-${compositions}`).toString('base64')}`;
      }
    }))
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const track = (name: string): SystemMediaTrack => ({ title: name, artist: 'Artist', imageRef: `dotify:cover:${name}` });
async function fixture() {
  const artwork = await import('./systemArtwork');
  return {
    ...artwork,
    async compose(input: SystemMediaTrack) {
      const index = images.length;
      const result = artwork.resolveSystemArtwork(input, new AbortController().signal);
      await vi.waitFor(() => expect(images.length).toBe(index + 1));
      images[index].onload!();
      return result;
    }
  };
}

it('reuses the same immutable cover across gateway aliases without retaining mutable result objects', async () => {
  const f = await fixture();
  const path = '/ipfs/QmQEkYGFqbS7AV58HrTgqfwPpSeQJMh4MeeSY1RwWRtVhu/cover/640.webp';
  const first = { title: 'First', artist: 'One', imageRef: `https://one.example${path}` };
  const second = { title: 'Second', artist: 'Two', imageRef: `https://two.example${path}` };
  expect(f.preparedSystemArtwork(first)).toBeNull();
  const result = await f.compose(first);
  const src = result[0].src;
  result[0].src = 'altered';
  const copy = f.preparedSystemArtwork(second)!;
  expect(copy[0].src).toBe(src);
  copy[0].src = 'altered again';
  expect((await f.resolveSystemArtwork(second, new AbortController().signal))[0].src).toBe(src);
  expect(compositions).toBe(1);
  expect(images).toHaveLength(1);
});

it('does not reuse a generated fallback for a different visual identity', async () => {
  const f = await fixture();
  const first = track('First');
  const result = await f.compose(first);
  expect(f.preparedSystemArtwork({ ...first, artist: 'Different attribution' })![0].src).toBe(result[0].src);
  expect(f.preparedSystemArtwork({ ...first, title: 'Changed title' })).toBeNull();
  expect(f.preparedSystemArtwork(track('Second'))).toBeNull();
});

it('does not cache a mutable HTTP cover even after it composes successfully', async () => {
  const f = await fixture();
  const input = { ...track('Live'), imageRef: 'https://covers.example/live.png' };
  await f.compose(input);
  expect(f.preparedSystemArtwork(input)).toBeNull();
  await f.compose(input);
  expect(compositions).toBe(2);
});

it('does not memoize a failed decode and permits a later successful retry', async () => {
  const f = await fixture();
  const input = { ...track('Retry'), imageRef: 'ipfs://QmQEkYGFqbS7AV58HrTgqfwPpSeQJMh4MeeSY1RwWRtVhu/cover/640.webp' };
  const pending = f.resolveSystemArtwork(input, new AbortController().signal);
  await vi.waitFor(() => expect(images).toHaveLength(1));
  images[0].onerror!();
  expect((await pending)[0].src).toMatch(/^https?:/);
  expect(f.preparedSystemArtwork(input)).toBeNull();
  await f.compose(input);
  expect(f.preparedSystemArtwork(input)![0].src).toMatch(/^data:image\/png/);
});

it('does not retain an image that completes after cancellation', async () => {
  const f = await fixture();
  const input = track('Cancelled');
  const controller = new AbortController();
  const pending = f.resolveSystemArtwork(input, controller.signal);
  await vi.waitFor(() => expect(images).toHaveLength(1));
  const lateLoad = images[0].onload!;
  const rejected = expect(pending).rejects.toThrow();
  controller.abort();
  lateLoad();
  await rejected;
  expect(f.preparedSystemArtwork(input)).toBeNull();
  expect(compositions).toBe(0);
});

it('still refuses an already cancelled owner when the PNG is cached', async () => {
  const f = await fixture();
  const input = track('Cached');
  await f.compose(input);
  const controller = new AbortController();
  controller.abort();
  await expect(f.resolveSystemArtwork(input, controller.signal)).rejects.toThrow();
  expect(compositions).toBe(1);
});

it('evicts the least recently used prepared cover without invalidating returned data URLs', async () => {
  const f = await fixture();
  const retained = await f.compose(track('0'));
  for (let index = 1; index < 8; index++) await f.compose(track(String(index)));
  expect(f.preparedSystemArtwork(track('0'))).not.toBeNull();
  await f.compose(track('8'));
  expect(f.preparedSystemArtwork(track('1'))).toBeNull();
  expect(f.preparedSystemArtwork(track('0'))![0].src).toBe(retained[0].src);
  expect(f.preparedSystemArtwork(track('8'))).not.toBeNull();
});

it('bounds prepared strings by bytes even before the entry limit is reached', async () => {
  const f = await fixture();
  pngOverride = `data:image/png;base64,${'A'.repeat(1_500_000)}`;
  await f.compose(track('0'));
  await f.compose(track('1'));
  await f.compose(track('2'));
  expect(f.preparedSystemArtwork(track('0'))).toBeNull();
  expect(f.preparedSystemArtwork(track('1'))).not.toBeNull();
  expect(f.preparedSystemArtwork(track('2'))).not.toBeNull();
});

it('returns but does not retain an output larger than the prepared budget', async () => {
  const f = await fixture();
  pngOverride = `data:image/png;base64,${'A'.repeat(4 * 1024 * 1024)}`;
  expect((await f.compose(track('Large')))[0].src).toBe(pngOverride);
  expect(f.preparedSystemArtwork(track('Large'))).toBeNull();
});

it('does not retain oversized inline identities or unknown/private cover schemes', async () => {
  const f = await fixture();
  const large = { ...track('Inline'), imageRef: `data:image/svg+xml;utf8,<svg><!--${'A'.repeat(17_000)}--></svg>` };
  const unknown = { ...track('Unknown'), imageRef: 'dotify:enc:v3:private-key-version:ipfs://private' };
  await f.compose(large);
  await f.compose(unknown);
  expect(f.preparedSystemArtwork(large)).toBeNull();
  expect(f.preparedSystemArtwork(unknown)).toBeNull();
});

it('distinguishes immutable image delivery, decode, composition and prepared reuse', async () => {
  const f = await fixture();
  const input = { ...track('Observed'), imageRef: 'ipfs://QmQEkYGFqbS7AV58HrTgqfwPpSeQJMh4MeeSY1RwWRtVhu/cover/640.webp' };
  const observe = vi.fn();
  const result = f.resolveSystemArtwork(input, new AbortController().signal, observe);
  await vi.waitFor(() => expect(images).toHaveLength(1));
  expect(observe.mock.calls.map(call => call[0])).toEqual(['image-load-started', 'image-ready', 'decode-started']);
  images[0].onload!();
  await result;
  expect(observe.mock.calls.map(call => call[0])).toEqual(['image-load-started', 'image-ready', 'decode-started', 'decoded', 'composed']);
  observe.mockClear();
  await f.resolveSystemArtwork(input, new AbortController().signal, observe);
  expect(observe.mock.calls).toEqual([['prepared-hit', 'png']]);
});
