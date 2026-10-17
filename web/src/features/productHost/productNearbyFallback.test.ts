import { expect, it } from 'vitest';
import { productNearbyBrowserUrl } from './productNearbyFallback';

it('preserves a public room link without transferring host or account authority', () => {
  expect(productNearbyBrowserUrl('https://dotify.example/?token=private', '#/rooms/ABCD23?secret=private')).toBe('https://dotify.example/#/rooms/ABCD23');
  expect(productNearbyBrowserUrl('https://dotify.example/', '', 'QWER23')).toBe('https://dotify.example/#/rooms/QWER23');
});
it('opens Rooms when no canonical room is available', () => {
  expect(productNearbyBrowserUrl('https://dotify.example/', '#/you?session=private')).toBe('https://dotify.example/#/rooms');
  expect(productNearbyBrowserUrl('https://dotify.example/', '#/rooms/abcd')).toBe('https://dotify.example/#/rooms');
});
it.each([undefined, '', 'http://dotify.example', 'javascript:alert(1)', 'https://user:secret@dotify.example'])(
  'rejects an unsafe or absent public origin (%s)',
  url => {
    expect(productNearbyBrowserUrl(url)).toBeNull();
  }
);
