// A recovery offer is public draft data, never a storage authorization or a key.
import { getAddress, isAddress } from 'viem';
import { bulletinAssetLocation } from '../../services/bulletinPublicAssets';
import type { DotifyTrackManifest } from '../../services/pinata';
import { isBulletinMediaRoot } from '../catalog/streamingTransport';
import { parseReleaseEditorialMetadata } from '../catalog/releaseMetadata';
import { manifestRequiredPersonhood } from '../runtime/accessEncoding';
import { dotToPlanck } from '../../shared/utils/format';
import type { PersonhoodLevel, ReleaseRoyaltySplitDraft } from '../../shared/types';

export type PreparedRelease = {
  owner: string;
  runtimeAddress: string;
  chainId: number;
  manifest: DotifyTrackManifest;
};
export type RecoveryContext = { owner: string; runtimeAddress: string | null; chainId: number | null; contentHash: string; connected: boolean };

export function matchesPreparedRelease(release: PreparedRelease, context: RecoveryContext): boolean {
  return (
    context.connected &&
    release.owner.toLowerCase() === context.owner.toLowerCase() &&
    release.runtimeAddress.toLowerCase() === context.runtimeAddress?.toLowerCase() &&
    release.chainId === context.chainId &&
    release.manifest.track.contentHash.toLowerCase() === context.contentHash.toLowerCase()
  );
}

export class PreparedReleaseRecoveryError extends Error {
  constructor(
    readonly preparedRelease: PreparedRelease,
    message: string
  ) {
    super(message);
    this.name = 'PreparedReleaseRecoveryError';
  }
}

const sameData = (a: unknown, b: unknown) =>
  JSON.stringify(a, (_key, value) =>
    value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value
  ) ===
  JSON.stringify(b, (_key, value) =>
    value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value
  );

/** Accept only a snapshot the current editor can reproduce, bound to the audio
 * just submitted. Invalid responses stay ordinary errors, with no restore action. */
export function parsePreparedRelease(value: unknown, requested: DotifyTrackManifest, owner: string, chainId: number): PreparedRelease | null {
  try {
    if (!value || typeof value !== 'object' || JSON.stringify(value).length > 50 * 1024) return null;
    const candidate = value as PreparedRelease;
    const m = candidate.manifest;
    const t = m.track;
    if (
      !isAddress(candidate.owner) ||
      !isAddress(candidate.runtimeAddress) ||
      candidate.owner.toLowerCase() !== owner.toLowerCase() ||
      candidate.chainId !== chainId
    )
      return null;
    if (
      m.schema !== 'dotify.track.v2' ||
      !Number.isFinite(Date.parse(m.createdAt)) ||
      t.contentHash !== requested.track.contentHash ||
      !/^0x[0-9a-f]{64}$/i.test(t.contentHash)
    )
      return null;
    if (
      m.assets.audioCID !== requested.assets.audioCID ||
      !isBulletinMediaRoot(m.assets.audioCID) ||
      m.assets.encrypted !== true ||
      m.assets.keyVersion !== requested.assets.keyVersion
    )
      return null;
    if (!/^dotify-content-key-v(?:[2-9]|[1-9][0-9]+)$/.test(m.assets.keyVersion ?? '')) return null;
    if (m.assets.coverCID !== '' && bulletinAssetLocation(m.assets.coverCID)?.path !== 'cover/640.webp') return null;
    for (const [text, max] of [
      [t.title, 200],
      [t.artistName, 200],
      [t.description, 2000]
    ] as const) {
      if (typeof text !== 'string' || !text.trim() || text !== text.trim() || text.length > max) return null;
    }
    if (t.durationSeconds !== null && (!Number.isFinite(t.durationSeconds) || t.durationSeconds <= 0 || t.durationSeconds > 86400)) return null;
    if (!['free', 'classic', 'human-free'].includes(t.accessMode) || t.zone !== 'Studio') return null;
    const personhood = t.requiredPersonhood === 'DIM2' ? 'DIM2' : 'DIM1';
    if (t.requiredPersonhood !== manifestRequiredPersonhood(t.accessMode, personhood)) return null;
    if (typeof t.priceDot !== 'string' || !/^\d+(?:\.\d{1,18})?$/.test(t.priceDot) || (t.accessMode !== 'classic' && t.priceDot !== '0')) return null;
    if (m.settlement.target !== 'evm' || m.settlement.pricePlanck !== dotToPlanck(t.priceDot).toString()) return null;
    const editorial = parseReleaseEditorialMetadata(m.editorial);
    if (!editorial || !sameData(editorial, m.editorial)) return null;
    if (!Array.isArray(m.royalties) || !m.royalties.length || m.royalties.length > 16) return null;
    if (
      m.royalties.some(
        (r, index) =>
          !isAddress(r.recipient) ||
          !Number.isInteger(r.bps) ||
          r.bps <= 0 ||
          r.bps > 10000 ||
          (index === 0 && r.recipient === owner ? false : getAddress(r.recipient) !== r.recipient)
      )
    )
      return null;
    const total = m.royalties.reduce((sum, r) => sum + r.bps, 0);
    if (total > 10000 || m.settlement.royaltyBps !== total) return null;
    // Reject unsupported extra fields rather than silently dropping them.
    const canonical: DotifyTrackManifest = {
      schema: m.schema,
      createdAt: m.createdAt,
      assets: { audioCID: m.assets.audioCID, coverCID: m.assets.coverCID, encrypted: true, keyVersion: m.assets.keyVersion },
      track: {
        contentHash: t.contentHash,
        title: t.title,
        artistName: t.artistName,
        description: t.description,
        durationSeconds: t.durationSeconds,
        accessMode: t.accessMode,
        priceDot: t.priceDot,
        requiredPersonhood: t.requiredPersonhood,
        zone: t.zone
      },
      editorial,
      royalties: m.royalties.map(r => ({ recipient: r.recipient, bps: r.bps })),
      settlement: { target: 'evm', royaltyBps: total, pricePlanck: m.settlement.pricePlanck }
    };
    return sameData(canonical, m) ? { owner: candidate.owner, runtimeAddress: candidate.runtimeAddress, chainId, manifest: canonical } : null;
  } catch {
    return null;
  }
}

export function preparedReleaseForm(release: PreparedRelease) {
  const m = release.manifest;
  const primary = m.royalties[0]?.recipient === release.owner ? m.royalties[0] : null;
  return {
    ...m.track,
    releaseMetadata: m.editorial,
    personhoodLevel: (m.track.requiredPersonhood === 'DIM2' ? 'DIM2' : 'DIM1') as PersonhoodLevel,
    royaltyBps: primary?.bps ?? 0,
    additionalRoyaltySplits: m.royalties.slice(primary ? 1 : 0).map(
      (r, index): ReleaseRoyaltySplitDraft => ({
        id: `prepared-${index}`,
        label: 'Rights holder',
        recipient: r.recipient,
        bps: r.bps
      })
    )
  };
}
