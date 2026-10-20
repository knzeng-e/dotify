import { createHash, randomBytes } from 'node:crypto';
import {
  createPublicClient,
  http,
  parseAbi,
  keccak256,
  encodeAbiParameters,
  zeroAddress,
  zeroHash,
  isAddress,
  BaseError,
  ContractFunctionRevertedError
} from 'viem';
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
  if (config.receiptToken && (typeof config.receiptToken !== 'string' || config.receiptToken.length < 32 || config.receiptToken.length > 256))
    throw new Error('Invalid native receipt service credential configuration.');
  const client = dependencies.client ?? (config.rpc ? createPublicClient({ transport: http(config.rpc, { timeout: 10000 }) }) : null);
  const signer = dependencies.signer ?? (config.key ? privateKeyToAccount(config.key) : null);
  const request = dependencies.fetch ?? fetch;
  async function chain() {
    if (!client || !Number.isSafeInteger(config.chainId) || config.chainId <= 0 || (await client.getChainId()) !== config.chainId)
      throw new Error('Room contribution network is unavailable.');
    return client;
  }
  async function knownTrack(runtime, hash) {
    if (!isAddress(runtime) || !hashPattern.test(hash) || !isAddress(config.directory ?? ''))
      throw Object.assign(new Error('Unknown release.'), { code: 'INVALID_RELEASE' });
    const rpc = await chain();
    const [track] = await rpc.readContract({ address: runtime, abi, functionName: 'musicRegGetTrack', args: [hash] });
    const registered = await rpc.readContract({ address: config.directory, abi, functionName: 'runtimeOf', args: [track.artist] });
    if (registered.toLowerCase() !== runtime.toLowerCase() || !track.active)
      throw Object.assign(new Error('The release could not be verified.'), { code: 'INVALID_RELEASE' });
    return track;
  }

  // Public registry metadata only. Bounded, short-lived and coalesced so room
  // cards do not issue a read for every viewer or every listener count update.
  const publicTracks = new Map();
  let publicTrackReads = 0;
  async function publicTrackStatus(track) {
    const runtime = track?.runtimeAddress;
    const hash = track?.hash;
    if (!isAddress(runtime ?? '') || !hashPattern.test(hash ?? '')) return { status: 'invalid' };
    const key = `${runtime}:${hash}`.toLowerCase();
    const cached = publicTracks.get(key);
    if (cached?.until > Date.now()) return cached.promise;
    for (const [id, value] of publicTracks) if (value.until <= Date.now()) publicTracks.delete(id);
    if (publicTracks.size >= 2000 || publicTrackReads >= 8) return { status: 'unavailable' };
    publicTrackReads++;
    const entry = { until: Infinity, promise: null };
    const promise = knownTrack(runtime, hash)
      .then(release => ({ status: 'verified', release }))
      .catch(error => ({
        status:
          error.code === 'INVALID_RELEASE' ||
          (error instanceof BaseError && error.walk(cause => cause instanceof ContractFunctionRevertedError) instanceof ContractFunctionRevertedError)
            ? 'invalid'
            : 'unavailable'
      }))
      .finally(() => {
        publicTrackReads--;
        entry.until = Date.now() + 30_000;
      });
    entry.promise = promise;
    publicTracks.set(key, entry);
    return promise;
  }

  async function publicTrack(track) {
    const result = await publicTrackStatus(track);
    return result.status === 'verified' ? result.release : null;
  }

  const artistIdentities = new Map();
  async function verifyArtistRuntime(runtime, token) {
    if (!config.api || !isAddress(runtime ?? '') || !isAddress(config.directory ?? '') || typeof token !== 'string' || !token || token.length > 4096)
      throw new Error('Connect your artist account to see live activity.');
    const key = createHash('sha256').update(`${runtime.toLowerCase()}:${token}`).digest('hex');
    const cached = artistIdentities.get(key);
    if (cached?.until > Date.now()) return cached.identity;
    for (const [id, value] of artistIdentities) if (value.until <= Date.now()) artistIdentities.delete(id);
    const response = await request(`${config.api.replace(/\/$/, '')}/auth/identity`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: globalThis.AbortSignal.timeout(10000)
    });
    if (!response.ok && response.status !== 401) throw new Error('Artist verification is temporarily unavailable.');
    const identity = response.ok ? await response.json() : null;
    if (!identity || !isAddress(identity.address ?? '') || identity.chainId !== config.chainId)
      throw Object.assign(new Error('Reconnect your artist account to see live activity.'), { code: 'SESSION_INVALID' });
    const rpc = await chain();
    const registered = await rpc.readContract({ address: config.directory, abi, functionName: 'runtimeOf', args: [identity.address] });
    if (registered.toLowerCase() !== runtime.toLowerCase()) throw new Error('This runtime does not belong to your artist account.');
    const verified = { address: identity.address.toLowerCase(), runtime: runtime.toLowerCase() };
    // This token has just passed the API verifier. Its signed expiry only
    // shortens a 20s revalidation window; malformed/legacy tokens are uncached.
    try {
      const expiry = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')).exp;
      if (Number.isSafeInteger(expiry) && expiry > Date.now() && artistIdentities.size < 2000)
        artistIdentities.set(key, { identity: verified, until: Math.min(expiry, Date.now() + 20_000) });
    } catch {
      /* An opaque token remains valid for this one API-verified read. */
    }
    return verified;
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
    publicTrack,
    publicTrackStatus,
    verifyArtistRuntime,
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
      if (response.status === 401)
        throw Object.assign(new Error('Your sign-in has expired. Reconnect your account for host tips.'), { code: 'SESSION_INVALID' });
      if (!response.ok) throw new Error('Account verification is temporarily unavailable. Try again shortly.');
      const identity = await response.json();
      if (!identity || !isAddress(identity.address ?? '') || identity.chainId !== config.chainId)
        throw new Error('The connected host account is on a different network. Reconnect to Dotify.');
      if (!stillHost()) throw new Error('The hosting session changed.');
      room.tipHost = identity.address;
      room.tipScope ??= `0x${randomBytes(32).toString('hex')}`;
    },
    async quote(room, input) {
      if (!room.hostId) throw new Error('The room is no longer hosted.');
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
      if (room.tipHost && !signer) throw new Error('Room tip verification is unavailable. Try again shortly.');
      const bound = Boolean(room.tipHost);
      room.tipScope ??= `0x${randomBytes(32).toString('hex')}`;
      const context = {
        contentHash: input.contentHash,
        intentId: input.intentId,
        host: bound ? room.tipHost : zeroAddress,
        room: bound ? room.tipScope : zeroHash,
        expiresAt: BigInt(Math.floor(Date.now() / 1000) + 600)
      };
      const digest = keccak256(
        encodeAbiParameters(
          [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, contextType, { type: 'uint256' }],
          [BigInt(config.chainId), input.runtime, input.sender, context, BigInt(input.amount)]
        )
      );
      const proof = bound ? await signer.signMessage({ message: { raw: digest } }) : '0x';
      // Old runtimes cannot accept room context without a recipient. Retain a
      // bounded server-side link to the unshared tip intent for chat verification.
      if (!bound) {
        room.tipIntents ??= new Map();
        for (const [id, intent] of room.tipIntents) if (intent.expiresAt < Date.now()) room.tipIntents.delete(id);
        if (room.tipIntents.size >= 1000) throw new Error('Room contribution limit reached. Try later.');
        const id = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }], [input.sender, input.intentId]));
        room.tipIntents.set(id, {
          runtime: input.runtime.toLowerCase(),
          contentHash: input.contentHash.toLowerCase(),
          sender: input.sender.toLowerCase(),
          amount: input.amount,
          expiresAt: Date.now() + 30 * 60 * 1000
        });
      }
      return { ok: true, host: context.host, room: context.room, expiresAt: context.expiresAt.toString(), proof };
    },
    async notification(room, { runtime, hash, nativeBlock }) {
      if (!isAddress(runtime ?? '') || !hashPattern.test(hash ?? '')) throw new Error('Invalid receipt.');
      const rpc = await chain();
      let logs;
      if (nativeBlock !== undefined) {
        if (!config.receiptToken) throw new Error('Native room announcements need the receipt service credential.');
        if (
          !config.api ||
          config.chainId !== 420420417 ||
          !Number.isSafeInteger(nativeBlock?.number) ||
          nativeBlock.number < 0 ||
          nativeBlock.number > 0xffffffff ||
          (nativeBlock.hash !== undefined && !hashPattern.test(nativeBlock.hash)) ||
          (nativeBlock.index !== undefined && (!Number.isSafeInteger(nativeBlock.index) || nativeBlock.index < 0))
        )
          throw new Error('Invalid native receipt block.');
        const response = await request(`${config.api.replace(/\/$/, '')}/contributions/native-receipt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.receiptToken}` },
          body: JSON.stringify({ hash, block: nativeBlock }),
          signal: globalThis.AbortSignal.timeout(25000)
        });
        const body = response.ok ? await response.json() : null;
        if (
          body?.status !== 'success' ||
          body.genesisHash !== '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2' ||
          body.hash?.toLowerCase() !== hash.toLowerCase() ||
          body.block?.number !== nativeBlock.number ||
          !hashPattern.test(body.block?.hash ?? '') ||
          (nativeBlock.hash && body.block.hash.toLowerCase() !== nativeBlock.hash.toLowerCase()) ||
          (nativeBlock.index !== undefined && body.block.index !== nativeBlock.index) ||
          !Array.isArray(body.logs) ||
          !body.logs.every(
            log =>
              log.transactionHash?.toLowerCase() === hash.toLowerCase() &&
              isAddress(log.address ?? '') &&
              Number.isSafeInteger(log.logIndex) &&
              log.logIndex >= 0 &&
              /^0x(?:[\da-f]{2})*$/i.test(log.data ?? '') &&
              Array.isArray(log.topics) &&
              log.topics.every(topic => hashPattern.test(topic))
          )
        )
          throw new Error('The native contribution could not be verified.');
        logs = body.logs;
      } else {
        const receipt = await rpc.getTransactionReceipt({ hash });
        const final = await rpc.getBlock({ blockTag: 'finalized' });
        if (receipt.status !== 'success' || receipt.blockNumber > final.number) throw new Error('The contribution is not finalized yet.');
        if ((await rpc.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw new Error('The payment receipt changed.');
        logs = receipt.logs;
      }
      const { parseEventLogs } = await import('viem');
      const event = parseEventLogs({ abi, logs, eventName: 'ContributionReceived' }).find(log => {
        if (log.address.toLowerCase() !== runtime.toLowerCase() || log.args.contentHash === zeroHash) return false;
        if (log.args.room !== zeroHash && log.args.room === room.tipScope) return true;
        const intent = room.tipIntents?.get(log.args.id);
        return (
          log.args.room === zeroHash &&
          log.args.host === zeroAddress &&
          intent &&
          intent.expiresAt >= Date.now() &&
          intent.runtime === runtime.toLowerCase() &&
          intent.contentHash === log.args.contentHash.toLowerCase() &&
          intent.sender === log.args.sender.toLowerCase() &&
          BigInt(intent.amount) === log.args.amount
        );
      });
      if (!event) throw new Error('This payment does not belong to this room.');
      const track = await knownTrack(runtime, event.args.contentHash);
      const id = `${config.chainId}:${runtime.toLowerCase()}:${hash.toLowerCase()}:${event.logIndex}`;
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
