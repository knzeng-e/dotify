import { isAddress, zeroAddress, type Address } from 'viem';
import type { ContributionPolicy } from './contributions';

export function effectiveRoomAuthority(policy: ContributionPolicy, fallback: ContributionPolicy): Address {
  return policy.roomAttestor !== zeroAddress ? policy.roomAttestor : fallback.roomAttestor;
}

/** Public verification key only. Selecting it still requires the artist's signed policy update. */
export async function readDotifyRoomAuthority(chainId: number, signal?: AbortSignal): Promise<Address> {
  const base = import.meta.env.VITE_SIGNAL_URL ?? `${window.location.protocol}//${window.location.hostname}:8788`;
  const response = await fetch(new URL('/contributions/config', base.replace(/^ws/, 'http')), {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
    credentials: 'omit',
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('Room verification is unavailable. Try again shortly.');
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== 'object' ||
    !('chainId' in value) ||
    value.chainId !== chainId ||
    !('attestor' in value) ||
    typeof value.attestor !== 'string' ||
    !isAddress(value.attestor) ||
    value.attestor === zeroAddress
  )
    throw new Error('Room verification is unavailable on this network. Try again shortly.');
  return value.attestor;
}
