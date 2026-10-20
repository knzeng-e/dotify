import { existingDotifySession, type DotifySessionIdentity, type KeyRequestSigner } from '../../services/keyService';

type RoomContributionSessionInput = {
  hostAccount?: `0x${string}`;
  hostSigner?: KeyRequestSigner;
  expectedChainId: number | null;
};

type ExistingSessionLookup = (identity: DotifySessionIdentity, chainId: number) => string | null;

/** Return an exact host session token, or the empty binding that clears server state. */
export function resolveRoomContributionSessionToken(
  input: RoomContributionSessionInput,
  findExistingSession: ExistingSessionLookup = existingDotifySession
): string {
  const { hostAccount, hostSigner, expectedChainId } = input;
  if (!hostAccount || !expectedChainId || !Number.isSafeInteger(expectedChainId) || expectedChainId <= 0) return '';
  if (hostSigner && hostSigner.address.toLowerCase() !== hostAccount.toLowerCase()) return '';
  return findExistingSession(hostSigner ?? { address: hostAccount }, expectedChainId) ?? '';
}
