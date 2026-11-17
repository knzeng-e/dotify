import { describe, expect, it } from 'vitest';
import { queuePendingIce } from './pendingIce';

describe('bounded pre-description ICE', () => {
  it('keeps ordered browser fields and discards duplicates, extra payloads and invalid candidates', () => {
    const queue = new Map<string, RTCIceCandidateInit[]>();
    const first = { candidate: 'candidate:first', sdpMid: '0', sdpMLineIndex: 0, usernameFragment: 'ufrag', ignored: 'not retained' };
    expect(queuePendingIce(queue, 'peer', first)).toBe(true);
    expect(queuePendingIce(queue, 'peer', first)).toBe(false);
    expect(queue.get('peer')).toEqual([{ candidate: first.candidate, sdpMid: '0', sdpMLineIndex: 0, usernameFragment: 'ufrag' }]);
    for (const candidate of [null, [], { candidate: 'x'.repeat(4097) }, { candidate: 'ok', sdpMid: {} }, { candidate: 'ok', sdpMLineIndex: -1 }])
      expect(queuePendingIce(queue, 'other', candidate as RTCIceCandidateInit)).toBe(false);
    expect(queue.size).toBe(1);
    queue.delete('peer');
    expect(queuePendingIce(queue, 'peer', first)).toBe(true);
  });

  it('bounds per-peer, aggregate and peer-identity accumulation', () => {
    const queue = new Map<string, RTCIceCandidateInit[]>();
    for (let i = 0; i < 128; i++) expect(queuePendingIce(queue, 'one', { candidate: `candidate:${i}` })).toBe(true);
    expect(queuePendingIce(queue, 'one', { candidate: 'overflow' })).toBe(false);
    for (let p = 2; p <= 4; p++) for (let i = 0; i < 128; i++) expect(queuePendingIce(queue, String(p), { candidate: `candidate:${i}` })).toBe(true);
    expect(queuePendingIce(queue, 'new', { candidate: 'aggregate overflow' })).toBe(false);
    queue.clear();
    for (let p = 0; p < 64; p++) expect(queuePendingIce(queue, String(p), { candidate: 'one each' })).toBe(true);
    expect(queuePendingIce(queue, 'overflow peer', { candidate: 'candidate' })).toBe(false);
    queue.clear();
    expect(queuePendingIce(queue, 'fresh', { candidate: 'after room teardown' })).toBe(true);
  });
});
