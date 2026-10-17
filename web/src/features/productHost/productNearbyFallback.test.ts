import { expect, it } from 'vitest';
import { productNearbyBrowserUrl } from './productNearbyFallback';

it.each([
  'https://dotify.example/',
  'https://dotify.example/?token=private',
  'https://dotify.example/#/rooms/ABCD23?secret=private',
  'https://dotify.example/?token=private#/you?session=private'
])('opens discovery without a room-entry route or account authority (%s)', publicAppUrl => {
  expect(productNearbyBrowserUrl(publicAppUrl)).toBe('https://dotify.example/#/rooms');
});
it('preserves the public app deployment path while replacing room-entry routes', () => {
  expect(productNearbyBrowserUrl('https://dotify.example/app/?token=private#/rooms/QWER23')).toBe('https://dotify.example/app/#/rooms');
});
it.each([undefined, '', 'http://dotify.example', 'javascript:alert(1)', 'https://user:secret@dotify.example'])(
  'rejects an unsafe or absent public origin (%s)',
  url => {
    expect(productNearbyBrowserUrl(url)).toBeNull();
  }
);
