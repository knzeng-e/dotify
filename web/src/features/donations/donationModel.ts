import { isAddress, parseUnits, zeroAddress, type Address, type Hash } from 'viem';
import type { CatalogTrack } from '../../shared/types';
import type { RuntimeReadPort } from '../runtime/runtimePorts';

export type DonationArtist = { name: string; recipient: Address; releaseTitle: string };
export type DonationAsset = { symbol: string; decimals: number; network: string };
export type DonationReceipt = { hash: Hash; amount: bigint };
export type DonationPort = {
  asset: DonationAsset;
  canCheckReceipt?: boolean;
  send: (recipient: Address, amount: bigint) => Promise<{ hash: Hash; finalized: boolean }>;
  confirm: (receipt: DonationReceipt, recipient: Address) => Promise<void>;
  destroy: () => void;
};
export const artistDonationsEnabled = import.meta.env.VITE_DOTIFY_ARTIST_DONATIONS === 'on';

export function parseDonationAmount(value: string, decimals: number): bigint {
  const normalized = value.trim().replace(',', '.');
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18 ||
    !/^\d+(?:\.\d+)?$/.test(normalized) ||
    (normalized.split('.')[1]?.length ?? 0) > decimals
  ) {
    throw new Error(`Enter a positive amount with up to ${decimals} decimal places.`);
  }
  const amount = parseUnits(normalized, decimals);
  if (amount <= 0n) throw new Error('Choose an amount greater than zero.');
  return amount;
}

export async function resolveDonationArtist(track: CatalogTrack, reader: RuntimeReadPort): Promise<DonationArtist> {
  const runtime = track.id.split(':')[0];
  if (!isAddress(runtime)) throw new Error('This artist does not yet have a verified receiving account.');
  const release = (await reader.listRuntimeTracks(runtime)).find(item => item.hash.toLowerCase() === track.hash.toLowerCase());
  if (!release || !release.record.active || !isAddress(release.record.artist) || release.record.artist === zeroAddress) {
    throw new Error('The receiving artist could not be verified. Try again after refreshing the release.');
  }
  // Names can collide and catalog metadata can be stale. The release's original
  // artist account, not an arbitrary name or catalog address, receives the gift.
  return { name: release.record.artistName, recipient: release.record.artist, releaseTitle: release.record.title };
}
