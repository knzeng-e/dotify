import { describe, expect, it, vi } from 'vitest';
import { encodeData, MAX_STATEMENT_SIZE } from '@parity/product-sdk-statement-store';
import { createPrivateRoomIdentity, type PrivateEnvelope } from './celerityPrivateChannel';
import type { RealtimeRoster } from './celerityPrivateTypes';

const now = 1_800_000_000_000;
const expiry = BigInt((now + 10_000) / 1000) << 32n;
async function room() {
  const alice = await createPrivateRoomIdentity();
  const bob = await createPrivateRoomIdentity();
  const eve = await createPrivateRoomIdentity();
  const roster: RealtimeRoster = {
    scope: 'a'.repeat(32),
    revision: 1,
    peers: [
      { id: '1'.repeat(16), role: 'host', publicKey: alice.publicKey },
      { id: '2'.repeat(16), role: 'listener', publicKey: bob.publicKey },
      { id: '3'.repeat(16), role: 'listener', publicKey: eve.publicKey }
    ]
  };
  return { roster, alice: alice.bind(roster.peers[0].id, roster), bob: bob.bind(roster.peers[1].id, roster), eve: eve.bind(roster.peers[2].id, roster) };
}

describe('membership-bound private room channel', () => {
  it('does not accept or publish crypto work resumed after its TTL', async () => {
    const { alice, bob } = await room();
    const sealed = await alice.seal(bob.self, { kind: 'chat', text: 'Before suspension' }, now);
    const clock = vi.spyOn(Date, 'now');
    try {
      clock.mockReturnValueOnce(now).mockReturnValue(now + 11_000);
      expect(await bob.inspect(sealed, expiry, now)).toEqual({ status: 'expired', kind: 'chat' });
      clock.mockReturnValueOnce(now).mockReturnValue(now + 11_000);
      expect(await alice.seal(bob.self, { kind: 'chat', text: 'Slow encryption' }, now)).toBeNull();
    } finally {
      clock.mockRestore();
    }
  });
  it('reports authenticated duplicates, reordering and expiry without delivering them twice', async () => {
    const { alice, bob } = await room();
    const first = await alice.seal(bob.self, { kind: 'chat', text: 'First' }, now);
    const second = await alice.seal(bob.self, { kind: 'chat', text: 'Second' }, now);
    expect(await bob.inspect(second, expiry, now)).toMatchObject({ status: 'accepted', outOfOrder: false });
    expect(await bob.inspect(first, expiry, now)).toMatchObject({ status: 'accepted', outOfOrder: true });
    expect(await bob.inspect(first, expiry, now)).toEqual({ status: 'duplicate', kind: 'chat' });
    expect(await bob.inspect(first, expiry, now + 10_000)).toEqual({ status: 'expired', kind: 'chat' });
    const tampered = [...first!] as PrivateEnvelope;
    tampered[5] -= 10_000;
    expect(await bob.inspect(tampered, expiry, now + 10_000)).toEqual({ status: 'invalid' });
  });
  it('exchanges confidential chat using actual SDK encoding, without public room or wallet identity', async () => {
    const { alice, bob, eve } = await room();
    const event = { kind: 'chat' as const, text: 'Private listening moment' };
    const sealed = (await alice.seal(bob.self, event, now))!;
    expect(encodeData(sealed).length).toBeLessThanOrEqual(MAX_STATEMENT_SIZE);
    expect(JSON.stringify(sealed)).not.toContain(event.text);
    expect(await eve.open(sealed, expiry, now)).toBeNull();
    const opened = await bob.open(sealed, expiry, now);
    expect(opened?.event).toEqual(event);
    expect(opened?.sender.role).toBe('host');
    expect(await bob.open(sealed, expiry, now)).toBeNull();
  });

  it('authenticates metadata and ciphertext before advancing replay state', async () => {
    const { alice, bob } = await room();
    const envelope = (await alice.seal(bob.self, { kind: 'request', text: 'Another song' }, now))!;
    for (const index of [1, 2, 3, 4, 5, 6, 7]) {
      const changed = [...envelope];
      const original = changed[index];
      changed[index] = typeof original === 'number' ? original + 1 : `${String(original)[0] === 'x' ? 'y' : 'x'}${String(original).slice(1)}`;
      expect(changed).not.toEqual(envelope);
      expect(await bob.open(changed, expiry, now)).toBeNull();
    }
    expect((await bob.open(envelope, expiry, now))?.seq).toBe(1);
  });

  it('accepts bounded reordering once, including concurrent duplicate delivery', async () => {
    const { alice, bob } = await room();
    const first = await alice.seal(bob.self, { kind: 'chat', text: 'First' }, now);
    const second = await alice.seal(bob.self, { kind: 'chat', text: 'Second' }, now);
    expect((await bob.open(second, expiry, now))?.seq).toBe(2);
    const duplicates = await Promise.all([bob.open(first, expiry, now), bob.open(first, expiry, now)]);
    expect(duplicates.filter(Boolean)).toHaveLength(1);
  });

  it('rejects removed peers, old roster revisions and reuse of a member ID with a different key', async () => {
    const { roster, alice, bob } = await room();
    const sealed = await alice.seal(bob.self, { kind: 'chat', text: 'Before leaving' }, now);
    expect(bob.update({ ...roster, revision: 2, peers: roster.peers.slice(1) })).toBe(true);
    expect(bob.update(roster)).toBe(false);
    expect(await bob.open(sealed, expiry, now)).toBeNull();
    expect(await bob.seal(alice.self, { kind: 'chat', text: 'Gone' }, now)).toBeNull();
    expect(bob.update({ ...roster, revision: 3, peers: roster.peers.map(peer => ({ ...peer, role: 'host' as const })) })).toBe(false);
  });

  it('binds keys to the private room scope and direction', async () => {
    const { roster, alice, bob, eve } = await room();
    const sealed = (await alice.seal(bob.self, { kind: 'chat', text: 'Only Bob' }, now))!;
    expect(bob.update({ ...roster, scope: 'b'.repeat(32), revision: 2 })).toBe(false);
    const redirected = [...sealed] as PrivateEnvelope;
    redirected[3] = eve.self;
    expect(await eve.open(redirected, expiry, now)).toBeNull();
    const reflected = [...sealed] as PrivateEnvelope;
    reflected[2] = bob.self;
    reflected[3] = alice.self;
    expect(await alice.open(reflected, expiry, now)).toBeNull();
  });

  it('rejects expiry, future timestamps, missing transport expiry and oversized/private-field payloads', async () => {
    const { alice, bob } = await room();
    const sealed = await alice.seal(bob.self, { kind: 'chat', text: 'Ephemeral' }, now);
    expect(await bob.open(sealed, expiry, now + 10_000)).toBeNull();
    expect(await bob.open(sealed, expiry, now - 6000)).toBeNull();
    expect(await bob.open(sealed, undefined, now)).toBeNull();
    expect(await alice.seal(bob.self, { kind: 'chat', text: 'a'.repeat(161) }, now)).toBeNull();
    expect(await alice.seal(bob.self, { kind: 'reaction', text: 'not a reaction' }, now)).toBeNull();
    expect(await alice.seal(bob.self, { kind: 'chat', text: 'hello', sourceKey: 'secret' } as never, now)).toBeNull();
    expect(await bob.open(sealed, expiry, now)).not.toBeNull();
  });

  it('discards async crypto results after stop or membership change', async () => {
    const { roster, alice, bob } = await room();
    const sealed = await alice.seal(bob.self, { kind: 'chat', text: 'Closing' }, now);
    const receiving = bob.open(sealed, expiry, now);
    bob.update({ ...roster, revision: 2, peers: roster.peers.slice(1) });
    expect(await receiving).toBeNull();
    const sending = alice.seal(bob.self, { kind: 'chat', text: 'Closing' }, now);
    alice.close();
    expect(await sending).toBeNull();
    expect(alice.peers()).toEqual([]);
  });
});
