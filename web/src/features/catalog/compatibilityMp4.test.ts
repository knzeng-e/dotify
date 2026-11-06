import { expect, it } from 'vitest';
import { compatibilityMp4 } from './compatibilityMp4';

function join(...parts: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
function box(type: string, payload = new Uint8Array()): Uint8Array {
  const bytes = new Uint8Array(payload.length + 8);
  new DataView(bytes.buffer).setUint32(0, bytes.length);
  bytes.set(new TextEncoder().encode(type), 4);
  bytes.set(payload, 8);
  return bytes;
}
function fragment(start: number, duration: number, sample: number): Uint8Array {
  const header = new Uint8Array(8);
  new DataView(header.buffer).setUint32(0, 0x020000);
  const payload = join(box('moof', box('traf', box('tfhd', header))), box('mdat', Uint8Array.of(sample)));
  const index = box('sidx', new Uint8Array(44));
  const view = new DataView(index.buffer);
  view.setUint32(8, 0x01000000);
  view.setUint32(12, 1);
  view.setUint32(16, 48_000);
  view.setBigUint64(20, BigInt(start));
  view.setUint16(38, 1);
  view.setUint32(40, payload.length);
  view.setUint32(44, duration);
  view.setUint32(48, 0x90000000);
  return join(box('styp'), index, payload);
}
const init = join(box('ftyp'), box('moov'));

it('indexes every authenticated fragment, preserves payload order and never mutates input', () => {
  const parts = [init, fragment(0, 192_512, 11), fragment(192_512, 192_512, 22), fragment(385_024, 512, 33)];
  const snapshots = parts.map(part => part.slice());
  const result = compatibilityMp4(parts);
  expect(result[0]).toBe(init);
  const index = new DataView(result[1].buffer);
  expect(index.getUint32(0)).toBe(76);
  expect(index.getUint16(38)).toBe(3);
  expect(index.getBigUint64(28)).toBe(0n);
  for (let i = 0; i < 3; i++) {
    expect(result[i + 2]).toEqual(parts[i + 1].subarray(60));
    expect(index.getUint32(40 + i * 12)).toBe(result[i + 2].length);
    expect(index.getUint32(48 + i * 12)).toBe(0x90000000);
  }
  expect([index.getUint32(44), index.getUint32(56), index.getUint32(68)]).toEqual([192_512, 192_512, 512]);
  expect(parts).toEqual(snapshots);
  expect(join(...result).length).toBeLessThan(join(...parts).length);
});

it('refuses a missing or discontinuous fragment and inconsistent timescales', () => {
  expect(() => compatibilityMp4([init])).toThrow(/container/);
  expect(() => compatibilityMp4([init, fragment(0, 100, 1), fragment(101, 100, 2)])).toThrow(/container/);
  const differentScale = fragment(100, 100, 2);
  new DataView(differentScale.buffer).setUint32(8 + 16, 44_100);
  expect(() => compatibilityMp4([init, fragment(0, 100, 1), differentScale])).toThrow(/container/);
});

it('refuses truncated, oversized or unsupported boxes instead of exposing partial audio', () => {
  const bytes = fragment(0, 100, 1);
  expect(() => compatibilityMp4([init, bytes.subarray(0, bytes.length - 1)])).toThrow(/container/);
  for (const size of [0, 1, 7, 0xffffffff]) {
    const invalid = bytes.slice();
    new DataView(invalid.buffer).setUint32(0, size);
    expect(() => compatibilityMp4([init, invalid])).toThrow(/container/);
  }
});

it('refuses external indexes, incorrect lengths, track changes and absolute data offsets', () => {
  // Field offsets include this test profile's 8-byte styp box.
  for (const [offset, value] of [
    [8 + 40, 1],
    [8 + 32, 1],
    [8 + 38, 2],
    [8 + 8, 0],
    [8 + 16, 0],
    [8 + 44, 0],
    [84, 0x020001],
    [84, 0x01020000]
  ]) {
    const bytes = fragment(0, 100, 1);
    const view = new DataView(bytes.buffer);
    if (offset === 46) view.setUint16(offset, value);
    else view.setUint32(offset, value);
    expect(() => compatibilityMp4([init, bytes]), `invalid field ${offset}`).toThrow(/container/);
  }
  const second = fragment(100, 100, 2);
  new DataView(second.buffer).setUint32(8 + 12, 2);
  expect(() => compatibilityMp4([init, fragment(0, 100, 1), second])).toThrow(/container/);
});
