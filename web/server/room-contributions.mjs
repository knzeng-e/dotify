import { randomBytes } from 'node:crypto';
import { createPublicClient, http, parseAbi, keccak256, encodeAbiParameters, zeroHash, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const abi = parseAbi([
  'function runtimeOf(address) view returns (address)',
  'function musicRegGetTrack(bytes32) view returns ((address artist,uint256 tokenId,string title,string artistName,string description,string imageRef,string audioRef,string metadataRef,string artistContractRef,uint16 royaltyBps,uint8 accessMode,uint128 pricePlanck,uint8 requiredPersonhood,uint64 registeredAtBlock,bool active) track,address tokenOwner)',
  'event ContributionReceived(bytes32 indexed id,bytes32 indexed contentHash,address indexed sender,uint256 amount,address host,bytes32 room,bytes32 campaign,bytes32 policy,uint64 timestamp)'
]);
const contextType = {
  type: 'tuple',
  components: [
    { name: 'contentHash', type: 'bytes32' },
    { name: 'intentId', type: 'bytes32' },
    { name: 'host', type: 'address' },
    { name: 'room', type: 'bytes32' },
    { name: 'expiresAt', type: 'uint64' }
  ]
};
const hashPattern = /^0x[\da-f]{64}$/i;

export function createRoomContributions(config, dependencies = {}) {
  if (config.key && !hashPattern.test(config.key)) throw new Error('Invalid room contribution attestor configuration.');
  const client = dependencies.client ?? (config.rpc ? createPublicClient({ transport: http(config.rpc, { timeout: 10000 }) }) : null);
  const signer = dependencies.signer ?? (config.key ? privateKeyToAccount(config.key) : null);
  const request = dependencies.fetch ?? fetch;
  async function chain() {
    if (!client || !Number.isSafeInteger(config.chainId) || config.chainId <= 0 || (await client.getChainId()) !== config.chainId)
      throw new Error('Room contribution network is unavailable.');
    return client;
  }
  async function knownTrack(runtime, hash) {
    if (!isAddress(runtime) || !hashPattern.test(hash) || !isAddress(config.directory ?? '')) throw new Error('Unknown release.');
    const rpc = await chain();
    const [track] = await rpc.readContract({ address: runtime, abi, functionName: 'musicRegGetTrack', args: [hash] });
    const registered = await rpc.readContract({ address: config.directory, abi, functionName: 'runtimeOf', args: [track.artist] });
    if (registered.toLowerCase() !== runtime.toLowerCase() || !track.active) throw new Error('The release could not be verified.');
    return track;
  }

  async function uniqueCatalogRelease(hash) {
    if (!config.api || !hashPattern.test(hash)) throw new Error('The room release could not be verified.');
    const response = await request(`${config.api.replace(/\/$/, '')}/catalog/releases/${hash.toLowerCase()}`, {
      signal: globalThis.AbortSignal.timeout(10000)
    });
    const body = response.ok ? await response.json() : null;
    const release = body?.release;
    if (
      !response.ok ||
      body?.meta?.state !== 'fresh' ||
      !release?.active ||
      release.hash?.toLowerCase() !== hash.toLowerCase() ||
      !isAddress(release.runtimeAddress ?? '')
    ) {
      throw new Error('The room release could not be verified. Try again in a moment.');
    }
    return release;
  }

  async function recoverTrack(room, expectedTrack = room.track) {
    if (!expectedTrack || room.track !== expectedTrack || expectedTrack.runtimeAddress || !hashPattern.test(expectedTrack.hash ?? '')) return null;
    const release = await uniqueCatalogRelease(expectedTrack.hash);
    await knownTrack(release.runtimeAddress, expectedTrack.hash);
    if (room.track !== expectedTrack || room.track?.runtimeAddress || room.track?.hash?.toLowerCase() !== expectedTrack.hash.toLowerCase()) return null;
    room.track = { ...expectedTrack, runtimeAddress: release.runtimeAddress.toLowerCase() };
    return room.track;
  }

  return {
    recoverTrack,
    async verifyArtist(room, token) {
      if (!config.api || typeof token !== 'string' || !token || token.length > 4096) throw new Error('Connect to Dotify before announcing your artist visit.');
      const expectedTrack = room.track;
      if (!expectedTrack?.hash) throw new Error('This room has no release to verify.');
      const track = expectedTrack.runtimeAddress ? expectedTrack : await recoverTrack(room, expectedTrack);
      if (!track || room.track !== track) throw new Error('The room changed tracks. Review your visit and try again.');
      const response = await request(`${config.api.replace(/\/$/, '')}/auth/identity`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: globalThis.AbortSignal.timeout(10000)
      });
      const identity = response.ok ? await response.json() : null;
      if (!identity || !isAddress(identity.address ?? '') || identity.chainId !== config.chainId)
        throw new Error('Your connection could not be verified. Reconnect to Dotify.');
      const release = await knownTrack(track?.runtimeAddress ?? '', track?.hash ?? '');
      if (release.artist.toLowerCase() !== identity.address.toLowerCase())
        throw new Error('Only the registered artist of this release can announce this visit.');
      if (room.track !== track) throw new Error('The room changed tracks. Review your visit and try again.');
      // These public labels come from the registry, never the submitted alias.
      return { name: release.artistName.slice(0, 100), title: release.title.slice(0, 200), runtime: track.runtimeAddress, hash: track.hash };
    },
    async bind(room, token, stillHost = () => true) {
      if (!config.api || typeof token !== 'string' || token.length > 4096) throw new Error('Sign in to Dotify to receive host tips.');
      const response = await request(`${config.api.replace(/\/$/, '')}/auth/identity`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: globalThis.AbortSignal.timeout(10000)
      });
      const identity = response.ok ? await response.json() : null;
      if (!identity || !isAddress(identity.address) || identity.chainId !== config.chainId)
        throw new Error('The connected host account could not be verified.');
      if (!stillHost()) throw new Error('The hosting session changed.');
      room.tipHost = identity.address;
      room.tipScope ??= `0x${randomBytes(32).toString('hex')}`;
    },
    async quote(room, input) {
      if (!signer || !room.tipHost || !room.hostId) throw new Error('The host needs to enable contributions for this room.');
      if (!isAddress(input.sender ?? '') || !hashPattern.test(input.intentId ?? '') || !/^[1-9]\d{0,76}$/.test(input.amount ?? ''))
        throw new Error('Invalid contribution.');
      if (room.track?.hash?.toLowerCase() !== input.contentHash?.toLowerCase()) throw new Error('The room track changed. Review the current track.');
      if (!room.track?.runtimeAddress) await recoverTrack(room, room.track);
      if (room.track?.runtimeAddress?.toLowerCase() !== input.runtime?.toLowerCase())
        throw new Error('The room release could not be identified. Reopen this track.');
      const originalHost = room.hostId;
      const originalAccount = room.tipHost;
      const originalTrack = room.track;
      await knownTrack(input.runtime, input.contentHash);
      if (
        !room.hostId ||
        room.hostId !== originalHost ||
        room.tipHost !== originalAccount ||
        room.track !== originalTrack ||
        room.track?.hash?.toLowerCase() !== input.contentHash.toLowerCase() ||
        room.track?.runtimeAddress?.toLowerCase() !== input.runtime.toLowerCase()
      )
        throw new Error('The room changed. Review the current track.');
      const context = {
        contentHash: input.contentHash,
        intentId: input.intentId,
        host: room.tipHost,
        room: room.tipScope,
        expiresAt: BigInt(Math.floor(Date.now() / 1000) + 600)
      };
      const digest = keccak256(
        encodeAbiParameters(
          [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, contextType, { type: 'uint256' }],
          [BigInt(config.chainId), input.runtime, input.sender, context, BigInt(input.amount)]
        )
      );
      const proof = await signer.signMessage({ message: { raw: digest } });
      return { ok: true, host: context.host, room: context.room, expiresAt: context.expiresAt.toString(), proof };
    },
    async notification(room, { runtime, hash }) {
      if (!isAddress(runtime ?? '') || !hashPattern.test(hash ?? '')) throw new Error('Invalid receipt.');
      const rpc = await chain();
      const receipt = await rpc.getTransactionReceipt({ hash });
      const final = await rpc.getBlock({ blockTag: 'finalized' });
      if (receipt.status !== 'success' || receipt.blockNumber > final.number) throw new Error('The contribution is not finalized yet.');
      if ((await rpc.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error('The payment receipt changed.');
      const { parseEventLogs } = await import('viem');
      const event = parseEventLogs({ abi, logs: receipt.logs, eventName: 'ContributionReceived' }).find(
        log => log.address.toLowerCase() === runtime.toLowerCase() && log.args.room === room.tipScope && log.args.contentHash !== zeroHash
      );
      if (!event) throw new Error('This payment does not belong to this room.');
      const track = await knownTrack(runtime, event.args.contentHash);
      const id = `${config.chainId}:${runtime.toLowerCase()}:${receipt.transactionHash.toLowerCase()}:${event.logIndex}`;
      room.tipNotified ??= new Set();
      if (room.tipNotified.has(id)) return null;
      if (room.tipNotified.size >= 1000) throw new Error('Room contribution notification limit reached.');
      room.tipNotified.add(id);
      return {
        id,
        senderId: 'dotify-confirmed-tip',
        senderName: 'Dotify',
        text: `${event.args.sender.slice(0, 6)}…${event.args.sender.slice(-4)} supported “${track.title}”.`,
        ts: Number(event.args.timestamp) * 1000
      };
    }
  };
}
