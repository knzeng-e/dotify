import { describe, expect, it } from 'vitest';
import { matchesPreparedRelease, parsePreparedRelease, preparedReleaseForm } from './preparedReleaseRecovery';
import { preparedReleaseFixture as fixture } from './preparedReleaseRecovery.fixture';
import { normalizeReleaseMetadata } from '../catalog/releaseMetadata';
import { dotToPlanck } from '../../shared/utils/format';

const parse = (value: unknown) => parsePreparedRelease(value, fixture.manifest, fixture.owner, fixture.chainId);
const context = {
  owner: fixture.owner,
  runtimeAddress: fixture.runtimeAddress,
  chainId: fixture.chainId,
  contentHash: fixture.manifest.track.contentHash,
  connected: true
};
describe('prepared release recovery', () => {
  it('restores exactly the admitted pilot fields and cover, with the original price and no payment or upload', () => {
    const release = parse(structuredClone(fixture))!;
    expect(release).toEqual(fixture);
    const form = preparedReleaseForm(release);
    expect(form.title).toBe('Bulletin pilot - 8s');
    expect(form.artistName).toBe('Thot Nzeng');
    expect(form.priceDot).toBe('1.21');
    expect(form.royaltyBps).toBe(10000);
    expect(form.additionalRoyaltySplits).toEqual([]);
    expect(release.manifest.assets.coverCID).toContain('/cover/640.webp');
    expect({
      ...release.manifest,
      track: {
        ...release.manifest.track,
        title: form.title,
        artistName: form.artistName,
        description: form.description,
        accessMode: form.accessMode,
        priceDot: form.priceDot,
        durationSeconds: form.durationSeconds
      },
      editorial: normalizeReleaseMetadata(form.releaseMetadata),
      royalties: [{ recipient: fixture.owner, bps: form.royaltyBps }],
      settlement: { target: 'evm', royaltyBps: form.royaltyBps, pricePlanck: dotToPlanck(form.priceDot).toString() }
    }).toEqual(fixture.manifest);
  });
  it('ignores malformed, unsupported or differently scoped snapshots instead of partially applying them', () => {
    const variants = [null, {}, { ...fixture, chainId: 1 }, { ...fixture, owner: '0x' + '11'.repeat(20) }, { ...fixture, runtimeAddress: 'bad' }];
    const mutate = (change: (m: typeof fixture.manifest) => void) => {
      const c = structuredClone(fixture);
      change(c.manifest);
      variants.push(c);
    };
    mutate(m => {
      m.track.contentHash = '0x' + '11'.repeat(32);
    });
    mutate(m => {
      m.assets.audioCID = 'other';
    });
    mutate(m => {
      m.assets.keyVersion = 'dotify-content-key-v3';
    });
    mutate(m => {
      m.assets.coverCID = 'https://untrusted.example/track.webp';
    });
    mutate(m => {
      m.track.priceDot = '-1';
    });
    mutate(m => {
      m.settlement.pricePlanck = '0';
    });
    mutate(m => {
      m.royalties[0].recipient = 'not an address';
    });
    mutate(m => {
      m.royalties[0].bps = 10001;
    });
    mutate(m => {
      m.editorial.genres = [' duplicate ', 'duplicate'];
    });
    mutate(m => {
      m.track.requiredPersonhood = 'DIM2';
    });
    mutate(m => {
      m.evm = { contractAddress: fixture.runtimeAddress, txHash: 'unreviewed' };
    });
    for (const value of variants) expect(parse(value)).toBeNull();
  });
  it('rejects a stale offer after wallet, runtime, chain, audio or connection changes', () => {
    expect(matchesPreparedRelease(fixture, context)).toBe(true);
    for (const changed of [{ owner: 'other' }, { runtimeAddress: null }, { chainId: 1 }, { contentHash: 'other' }, { connected: false }])
      expect(matchesPreparedRelease(fixture, { ...context, ...changed })).toBe(false);
  });
});
