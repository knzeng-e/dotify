import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudioStartupTelemetrySnapshot } from './audioStartupTelemetry';
import {
  FIRST_SOUND_EVIDENCE_STORAGE_KEY,
  beginFirstSoundAttempt,
  bindFirstSoundCandidate,
  buildFirstSoundEvidence,
  finishFirstSoundAttempt,
  percentile,
  readFirstSoundEvidenceDraft,
  serializeFirstSoundEvidence
} from './firstSoundEvidence';

const SHA = '1234567890abcdef1234567890abcdef12345678';
const CID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3ooqb5x4nqyd7bkhzbr6f5o4e';

function snapshot(startedAt: number): AudioStartupTelemetrySnapshot {
  return {
    dav2: [
      {
        phase: 'first-range-ready',
        audioRef: 'dotify:enc:v2:ipfs://private-ref-not-exported',
        cid: 'private-cid-not-exported',
        elapsedMs: 310,
        timestamp: startedAt + 10,
        gatewayUrl: 'https://private-gateway.example/ipfs/cid',
        rangeStart: 120,
        rangeEnd: 511,
        hedged: true,
        intentPrefetched: true
      },
      {
        phase: 'first-chunk-decrypted',
        audioRef: 'dotify:enc:v2:ipfs://private-ref-not-exported',
        cid: 'private-cid-not-exported',
        elapsedMs: 420,
        timestamp: startedAt + 20,
        decryptor: 'worker'
      }
    ],
    host: [
      { phase: 'playback-intent', source: 'private-track-id', elapsedMs: 0, timestamp: startedAt + 1 },
      { phase: 'source-selected', source: 'blob:private-source', elapsedMs: 0, timestamp: startedAt + 500 },
      { phase: 'first-audio', source: 'blob:private-source', elapsedMs: 312.4, timestamp: startedAt + 813, durationSeconds: 120 }
    ],
    latestFirstSoundMs: 312.4
  };
}

describe('first-sound evidence capture', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    const localStorage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: key => values.get(key) ?? null,
      key: index => [...values.keys()][index] ?? null,
      removeItem: key => void values.delete(key),
      setItem: (key, value) => void values.set(key, value)
    };
    vi.stubGlobal('window', { localStorage });
  });

  it('binds samples to an exact candidate and clears data when the candidate changes', () => {
    const first = bindFirstSoundCandidate({ buildSha: SHA, productAppVersion: '[0, 1, 25]' }, CID);
    expect(first?.candidate).toEqual({ gitSha: SHA, productAppVersion: '[0, 1, 25]', deployedCid: CID });

    beginFirstSoundAttempt('standalone-chrome', 'free', 'cold', 1_000);
    finishFirstSoundAttempt(snapshot(1_000), 2_000);
    expect(readFirstSoundEvidenceDraft()?.samples).toHaveLength(1);

    const next = bindFirstSoundCandidate({ buildSha: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd', productAppVersion: '[0, 1, 26]' }, CID);
    expect(next?.samples).toEqual([]);
    expect(next?.activeAttempt).toBeNull();
  });

  it('requires complete Product deployment identity only for Product surfaces', () => {
    expect(bindFirstSoundCandidate({ buildSha: SHA, productAppVersion: '[0, 1, 25]' }, 'not-a-cid')).toBeNull();
    bindFirstSoundCandidate({ buildSha: SHA, productAppVersion: null }, '');

    expect(beginFirstSoundAttempt('standalone-safari', 'free', 'cold', 1_000)?.activeAttempt?.surface).toBe('standalone-safari');
    expect(beginFirstSoundAttempt('standalone-safari', 'warm-next-track', 'cold', 1_500)).toBeNull();
    expect(beginFirstSoundAttempt('product-desktop', 'free', 'cold', 2_000)).toBeNull();
  });

  it('captures sanitized timing and DAV2 path facts after an audible result', () => {
    bindFirstSoundCandidate({ buildSha: SHA, productAppVersion: '[0, 1, 25]' }, CID);
    beginFirstSoundAttempt('product-desktop', 'authorized-protected', 'warm', 1_000);
    const draft = finishFirstSoundAttempt(snapshot(1_000), 2_000);

    expect(draft?.activeAttempt).toBeNull();
    expect(draft?.samples).toEqual([
      expect.objectContaining({
        surface: 'product-desktop',
        flow: 'authorized-protected',
        cacheState: 'warm',
        outcome: 'first-audio',
        firstSoundMs: 812,
        dav2: {
          observed: true,
          fallback: false,
          hedged: true,
          intentPrefetched: true,
          decryptor: 'worker',
          firstRangeBytes: 392
        }
      })
    ]);

    const serialized = serializeFirstSoundEvidence(buildFirstSoundEvidence(draft!, 3_000));
    expect(serialized).not.toContain('private-ref');
    expect(serialized).not.toContain('private-cid');
    expect(serialized).not.toContain('private-gateway');
    expect(serialized).not.toContain('blob:private-source');
    expect(JSON.parse(serialized).privacy).toEqual({
      walletAddressesCollected: false,
      mediaReferencesCollected: false,
      gatewayUrlsCollected: false,
      perListenerHistoryCollected: false
    });
  });

  it('does not capture before playback intent and a terminal audio event are both observed', () => {
    bindFirstSoundCandidate({ buildSha: SHA, productAppVersion: null }, '');
    beginFirstSoundAttempt('ios-safari', 'free', 'cold', 1_000);

    expect(finishFirstSoundAttempt({ dav2: [], host: [], latestFirstSoundMs: null }, 2_000)).toBeNull();
    expect(readFirstSoundEvidenceDraft()?.activeAttempt).not.toBeNull();
  });

  it('captures a DAV2 failure that happens before an audio source exists', () => {
    bindFirstSoundCandidate({ buildSha: SHA, productAppVersion: null }, '');
    beginFirstSoundAttempt('standalone-chrome', 'authorized-protected', 'cold', 1_000);

    const draft = finishFirstSoundAttempt(
      {
        host: [{ phase: 'playback-intent', source: 'private-track-id', elapsedMs: 0, timestamp: 1_100 }],
        dav2: [
          {
            phase: 'error',
            audioRef: 'dotify:enc:v2:ipfs://private-ref',
            cid: 'private-cid',
            elapsedMs: 600,
            timestamp: 1_700,
            detail: 'private gateway failure'
          }
        ],
        latestFirstSoundMs: null
      },
      2_000
    );

    expect(draft?.activeAttempt).toBeNull();
    expect(draft?.samples).toEqual([expect.objectContaining({ outcome: 'error', firstSoundMs: null, dav2: expect.objectContaining({ observed: true }) })]);
    expect(serializeFirstSoundEvidence(buildFirstSoundEvidence(draft!, 3_000))).not.toContain('private gateway failure');
  });

  it('fails closed when persisted evidence is malformed', () => {
    window.localStorage.setItem(FIRST_SOUND_EVIDENCE_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, candidate: { gitSha: 'wrong' }, samples: [] }));
    expect(readFirstSoundEvidenceDraft()).toBeNull();
  });

  it('uses nearest-rank percentiles for release budgets', () => {
    expect(percentile([400, 100, 300, 200], 0.75)).toBe(300);
    expect(percentile([], 0.75)).toBeNull();
  });
});
