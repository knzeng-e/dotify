import type { WalletClient } from 'viem';
import { ensureDotifySession, ensureDotifySessionForSigner, type KeyRequestSigner } from '../../services/keyService';
import { resolveRoomContributionSessionToken } from '../donations/roomContributionSession';

/** Explicit announced entry may sign in once; ordinary visits never need a session. */
export async function artistVisitSession(input: {
  account?: `0x${string}`;
  signer?: KeyRequestSigner;
  chainId: number | null;
  getWalletClient: () => Promise<WalletClient>;
}): Promise<string> {
  const { account, signer, chainId } = input;
  if (!account) throw new Error('Connect your artist account to announce your visit.');
  if (!chainId || !Number.isSafeInteger(chainId) || chainId <= 0) throw new Error('The artist network is still loading. Try again shortly.');
  if (signer && signer.address.toLowerCase() !== account.toLowerCase()) throw new Error('Your account changed. Try joining again.');
  const cached = resolveRoomContributionSessionToken({ hostAccount: account, hostSigner: signer, expectedChainId: chainId });
  if (cached) return cached;
  let token: string | null;
  if (signer) token = await ensureDotifySessionForSigner(signer, chainId);
  else {
    const client = await input.getWalletClient();
    if (client.account?.address.toLowerCase() !== account.toLowerCase() || client.chain?.id !== chainId)
      throw new Error('Your account or network changed. Try joining again.');
    token = await ensureDotifySession(client, chainId);
  }
  if (!token) throw new Error('Artist verification is temporarily unavailable. Try again, or join without announcing.');
  return token;
}
