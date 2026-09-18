import { describe, expect, it } from 'vitest';
import type { RoomQualityTelemetrySnapshot } from '../rooms/roomQualityTelemetry';
import {
  bindCurrentProductRoom,
  bindProductRoomSmokeCandidate,
  buildProductRoomSmokeEvidence,
  readProductRoomSmokeDraft,
  updateProductRoomSmokeDraft,
  type ProductRoomSmokeContext
} from './productRoomSmokeEvidence';

const SHA = '1234567890abcdef1234567890abcdef12345678';
const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3ooqb5x4nqyd7bkhzbr6f5o4e';
const OTHER_CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2C19Rhdm9zYgC5xA7a7H';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key)
  };
}

function context(patch: Partial<ProductRoomSmokeContext> = {}): ProductRoomSmokeContext {
  return {
    buildSha: SHA,
    productAppVersion: '[0, 1, 25]',
    productId: 'dotify-test01.dot',
    publicAppUrl: 'https://dotify-test01.dev-dot.li',
    productHostStatus: 'available',
    hostOrigin: 'polkadot://dotify-test01.dot',
    mode: 'host',
    roomId: 'LIVE42',
    sessionLink: 'https://dotify-test01.dev-dot.li/#/rooms/LIVE42',
    listenerCount: 1,
    localStreamReady: true,
    ...patch
  };
}

function snapshot(): RoomQualityTelemetrySnapshot {
  return {
    latestJoinToConnectedMs: null,
    latestRemoteAudioMs: null,
    relayConnectionCount: 0,
    events: [
      { phase: 'room-created', role: 'host', roomId: 'LIVE42', timestamp: 1_100 },
      { phase: 'stream-ready', role: 'host', roomId: 'LIVE42', timestamp: 1_200 },
      { phase: 'peer-connected', role: 'host', roomId: 'LIVE42', timestamp: 1_300, listenerCount: 1 }
    ]
  };
}

describe('Product room smoke evidence', () => {
  it('builds candidate-bound evidence from actual host telemetry and explicit guest observations', () => {
    const storage = memoryStorage();
    expect(bindProductRoomSmokeCandidate(context(), CID, storage, new Date(1_000))).not.toBeNull();
    expect(bindCurrentProductRoom('live42', storage)).toMatchObject({ startedAt: new Date(1_000).toISOString() });
    const draft = updateProductRoomSmokeDraft(
      {
        hostSurface: 'product-desktop',
        hostVersion: 'Product Desktop 0.1.0',
        guestOrigin: 'https://muzinga.netlify.app',
        hostSharedCanonicalUrl: true,
        guestWalletlessObserved: true,
        guestHeardAudio: true,
        guestInSync: true
      },
      storage
    );

    const evidence = buildProductRoomSmokeEvidence(context(), draft!, snapshot(), new Date('2026-09-18T04:00:00.000Z'));

    expect(evidence).toMatchObject({
      schemaVersion: 2,
      candidate: { gitSha: SHA, productAppVersion: '[0, 1, 25]', deployedCid: CID },
      canonicalRoomUrl: 'https://dotify-test01.dev-dot.li/#/rooms/LIVE42',
      guestAccountConnected: false,
      guestJoined: true,
      guestHeardAudio: true,
      guestInSync: true,
      hostRoomCreated: true,
      hostStreamReady: true,
      hostPeerConnected: true,
      hostListenerCount: 1
    });
    expect(evidence.checks.every(check => check.tone === 'ok')).toBe(true);
    const exportedKeys: string[] = [];
    JSON.stringify(evidence, (key, value) => {
      if (key) exportedKeys.push(key);
      return value;
    });
    expect(exportedKeys).not.toEqual(expect.arrayContaining(['walletAddress', 'candidateId', 'peerId', 'ipAddress', 'signature']));
  });

  it('does not count stale, listener-side, or other-room telemetry as host evidence', () => {
    const storage = memoryStorage();
    bindProductRoomSmokeCandidate(context(), CID, storage, new Date(2_000));
    bindCurrentProductRoom('LIVE42', storage);
    const draft = readProductRoomSmokeDraft(storage)!;
    const stale: RoomQualityTelemetrySnapshot = {
      latestJoinToConnectedMs: 1,
      latestRemoteAudioMs: 1,
      relayConnectionCount: 0,
      events: [
        { phase: 'room-created', role: 'host', roomId: 'LIVE42', timestamp: 1_000 },
        { phase: 'stream-ready', role: 'listener', roomId: 'LIVE42', timestamp: 3_000 },
        { phase: 'peer-connected', role: 'host', roomId: 'OTHER1', timestamp: 3_000 }
      ]
    };

    const evidence = buildProductRoomSmokeEvidence(context(), draft, stale);
    expect(evidence.hostRoomCreated).toBe(false);
    expect(evidence.hostStreamReady).toBe(false);
    expect(evidence.hostPeerConnected).toBe(false);
    expect(evidence.guestJoined).toBe(false);
  });

  it('recognizes a live stream that started before the guest peer connected', () => {
    const storage = memoryStorage();
    bindProductRoomSmokeCandidate(context(), CID, storage, new Date(1_000));
    bindCurrentProductRoom('LIVE42', storage);
    const draft = readProductRoomSmokeDraft(storage)!;
    const guestJoinedAfterPlayback: RoomQualityTelemetrySnapshot = {
      latestJoinToConnectedMs: null,
      latestRemoteAudioMs: null,
      relayConnectionCount: 0,
      events: [
        { phase: 'room-created', role: 'host', roomId: 'LIVE42', timestamp: 1_100 },
        { phase: 'peer-connected', role: 'host', roomId: 'LIVE42', timestamp: 1_300, listenerCount: 1 }
      ]
    };

    const evidence = buildProductRoomSmokeEvidence(context({ localStreamReady: true }), draft, guestJoinedAfterPlayback);

    expect(evidence.hostPeerConnected).toBe(true);
    expect(evidence.hostStreamReady).toBe(true);
    expect(buildProductRoomSmokeEvidence(context({ localStreamReady: false }), draft, guestJoinedAfterPlayback).hostStreamReady).toBe(false);
  });

  it('clears room observations when a different deployment is bound', () => {
    const storage = memoryStorage();
    bindProductRoomSmokeCandidate(context(), CID, storage, new Date(1_000));
    bindCurrentProductRoom('LIVE42', storage);
    updateProductRoomSmokeDraft({ guestHeardAudio: true, guestInSync: true }, storage);

    const rebound = bindProductRoomSmokeCandidate(context(), OTHER_CID, storage, new Date(2_000));
    expect(rebound).toMatchObject({
      candidate: { deployedCid: OTHER_CID },
      roomId: null,
      guestHeardAudio: false,
      guestInSync: false
    });
  });

  it('rejects incomplete candidate identity instead of recording ambiguous evidence', () => {
    const storage = memoryStorage();
    expect(bindProductRoomSmokeCandidate(context({ buildSha: 'short' }), CID, storage)).toBeNull();
    expect(bindProductRoomSmokeCandidate(context(), 'not-a-cid', storage)).toBeNull();
    expect(readProductRoomSmokeDraft(storage)).toBeNull();
  });
});
