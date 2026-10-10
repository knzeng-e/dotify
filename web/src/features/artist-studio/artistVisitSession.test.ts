import { beforeEach, expect, it, vi } from 'vitest';
import type { WalletClient } from 'viem';
import { artistVisitSession } from './artistVisitSession';
import { ensureDotifySession, ensureDotifySessionForSigner } from '../../services/keyService';
import { resolveRoomContributionSessionToken } from '../donations/roomContributionSession';

vi.mock('../../services/keyService', () => ({ ensureDotifySession: vi.fn(), ensureDotifySessionForSigner: vi.fn() }));
vi.mock('../donations/roomContributionSession', () => ({ resolveRoomContributionSessionToken: vi.fn() }));
const account = '0x1111111111111111111111111111111111111111' as const;
const other = '0x2222222222222222222222222222222222222222' as const;
const signer = { address: account, signMessage: vi.fn() };
const getWalletClient = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(resolveRoomContributionSessionToken).mockReturnValue('');
});
it('reuses the exact existing session without a new signature or wallet client', async () => {
  vi.mocked(resolveRoomContributionSessionToken).mockReturnValue('existing');
  await expect(artistVisitSession({ account, signer, chainId: 42, getWalletClient })).resolves.toBe('existing');
  expect(ensureDotifySessionForSigner).not.toHaveBeenCalled();
  expect(getWalletClient).not.toHaveBeenCalled();
});
it('opens one Product session on explicit announced entry when no session exists', async () => {
  vi.mocked(ensureDotifySessionForSigner).mockResolvedValue('product-session');
  await expect(artistVisitSession({ account, signer, chainId: 42, getWalletClient })).resolves.toBe('product-session');
  expect(ensureDotifySessionForSigner).toHaveBeenCalledWith(signer, 42);
  expect(getWalletClient).not.toHaveBeenCalled();
});
it('uses the connected extension client for first-time artist authentication', async () => {
  const client = { account: { address: account }, chain: { id: 42 } } as unknown as WalletClient;
  getWalletClient.mockResolvedValue(client);
  vi.mocked(ensureDotifySession).mockResolvedValue('extension-session');
  await expect(artistVisitSession({ account, chainId: 42, getWalletClient })).resolves.toBe('extension-session');
  expect(ensureDotifySession).toHaveBeenCalledWith(client, 42);
});
it('refuses changed extension identity or chain before signing', async () => {
  for (const client of [
    { account: { address: other }, chain: { id: 42 } },
    { account: { address: account }, chain: { id: 1 } }
  ]) {
    getWalletClient.mockResolvedValue(client);
    await expect(artistVisitSession({ account, chainId: 42, getWalletClient })).rejects.toThrow('changed');
  }
  expect(ensureDotifySession).not.toHaveBeenCalled();
});
it('fails closed without an account, chain or matching Product signer', async () => {
  await expect(artistVisitSession({ chainId: 42, getWalletClient })).rejects.toThrow('Connect');
  await expect(artistVisitSession({ account, chainId: null, getWalletClient })).rejects.toThrow('network');
  await expect(artistVisitSession({ account, signer: { ...signer, address: other }, chainId: 42, getWalletClient })).rejects.toThrow('changed');
  expect(resolveRoomContributionSessionToken).not.toHaveBeenCalled();
});
it('keeps session-service failures visible instead of joining unannounced', async () => {
  vi.mocked(ensureDotifySessionForSigner).mockRejectedValue(new Error('Sign-in unavailable'));
  await expect(artistVisitSession({ account, signer, chainId: 42, getWalletClient })).rejects.toThrow('Sign-in unavailable');
});
