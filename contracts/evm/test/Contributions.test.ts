import { expect } from 'chai';
import hre from 'hardhat';
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { keccak256, toBytes, zeroAddress, zeroHash, parseEther, encodeAbiParameters, toFunctionSelector, type Abi, type AbiFunction } from 'viem';

const hash = keccak256(toBytes('free-work'));
const policy = {
  version: 0n,
  startsAt: 0n,
  endsAt: 0n,
  hostBps: 0,
  roomAttestor: zeroAddress,
  campaign: zeroHash,
  description: '',
  recipients: [] as `0x${string}`[],
  shares: [] as number[]
};
const selectors = (abi: Abi) => abi.filter((x): x is AbiFunction => x.type === 'function').map(toFunctionSelector);
async function fixture() {
  const [artist, donor, collaborator, host, cause, attestor] = await hre.viem.getWalletClients();
  const cut = await hre.viem.deployContract('DiamondCutPallet');
  const registry = await hre.viem.deployContract('MusicRegistryPallet');
  const royalty = await hre.viem.deployContract('MusicRoyaltiesPallet');
  const access = await hre.viem.deployContract('MusicAccessPallet');
  const runtime = await hre.viem.deployContract('SmartRuntime', [
    artist.account.address,
    [cut, registry, royalty, access].map(item => ({ facetAddress: item.address, action: 0, functionSelectors: selectors(item.abi) })),
    zeroAddress,
    '0x'
  ]);
  const reg = await hre.viem.getContractAt('MusicRegistryPallet', runtime.address);
  const gifts = await hre.viem.getContractAt('MusicContributionsPallet', runtime.address);
  await reg.write.musicRegRegister([
    {
      contentHash: hash,
      title: 'Free work',
      artistName: 'Artist',
      description: 'Description',
      imageRef: 'ipfs://cover',
      audioRef: 'ipfs://audio',
      metadataRef: 'ipfs://metadata',
      artistContractRef: 'rights',
      accessMode: 2,
      pricePlanck: 0n,
      requiredPersonhood: 0
    },
    [artist.account.address, collaborator.account.address],
    [7000, 3000]
  ]);
  const context = {
    contentHash: hash,
    intentId: keccak256(toBytes('intent')),
    host: zeroAddress,
    room: zeroHash,
    expiresAt: BigInt((await time.latest()) + 600)
  };
  return { artist, donor, collaborator, host, cause, attestor, runtime, reg, gifts, context, client: await hre.viem.getPublicClient() };
}
async function rejects(promise: Promise<unknown>, message: string) {
  try {
    await promise;
    expect.fail('Expected rejection');
  } catch (error) {
    expect(String(error)).to.include(message);
  }
}

describe('Native gifts and tips', () => {
  it('tips a free work repeatedly, preserving splits without granting paid access', async () => {
    const { gifts, context, donor, runtime, collaborator, client } = await loadFixture(fixture);
    const before = await client.getBalance({ address: collaborator.account.address });
    const amount = parseEther('10');
    const q = await gifts.read.musicGiftQuote([context, amount]);
    await gifts.write.musicGiftContribute([context, q.digest, '0x'], { account: donor.account, value: amount });
    expect((await client.getBalance({ address: collaborator.account.address })) - before).to.equal(parseEther('3'));
    const access = await hre.viem.getContractAt('MusicAccessPallet', runtime.address);
    expect(await access.read.musicAccHasPaid([hash, donor.account.address])).to.equal(false);
    await rejects(gifts.write.musicGiftContribute([context, q.digest, '0x'], { account: donor.account, value: amount }), 'already submitted');
    const second = { ...context, intentId: keccak256(toBytes('second')) };
    const quote = await gifts.read.musicGiftQuote([second, amount]);
    await gifts.write.musicGiftContribute([second, quote.digest, '0x'], { account: donor.account, value: amount });
  });
  it('directs personal gifts to causes and rejects stale confirmations and unauthorized changes', async () => {
    const { gifts, context, cause, donor } = await loadFixture(fixture);
    const gift = { ...context, contentHash: zeroHash };
    const old = await gifts.read.musicGiftQuote([gift, 1000n]);
    const next = { ...policy, recipients: [cause.account.address], shares: [10000], campaign: hash };
    await rejects(gifts.write.musicGiftSetPolicy([zeroHash, next], { account: donor.account }), 'not owner');
    await gifts.write.musicGiftSetPolicy([zeroHash, next]);
    await rejects(gifts.write.musicGiftContribute([gift, old.digest, '0x'], { account: donor.account, value: 1000n }), 'review changed distribution');
    const q = await gifts.read.musicGiftQuote([gift, 1000n]);
    expect(q.recipients[0].toLowerCase()).to.equal(cause.account.address);
    expect(q.amounts[0]).to.equal(1000n);
    expect(q.campaign).to.equal(hash);
  });
  it('takes the host share from the tip before splitting the remainder among rights holders', async () => {
    const { gifts, context, host, cause, collaborator, attestor, donor, runtime, client } = await loadFixture(fixture);
    await gifts.write.musicGiftSetPolicy([
      hash,
      { ...policy, hostBps: 2000, roomAttestor: attestor.account.address, recipients: [cause.account.address], shares: [10000] }
    ]);
    const ctx = { ...context, host: host.account.address, room: keccak256(toBytes('room')) };
    const amount = parseEther('10');
    const q = await gifts.read.musicGiftQuote([ctx, amount]);
    expect(q.roles).to.deep.equal([2, 1, 0, 0]);
    expect(q.amounts).to.deep.equal([parseEther('2'), parseEther('2.4'), parseEther('5.6'), 0n]);
    expect(q.amounts.reduce((total, share) => total + share, 0n)).to.equal(amount);
    const type = {
      type: 'tuple',
      components: [
        { name: 'contentHash', type: 'bytes32' },
        { name: 'intentId', type: 'bytes32' },
        { name: 'host', type: 'address' },
        { name: 'room', type: 'bytes32' },
        { name: 'expiresAt', type: 'uint64' }
      ]
    } as const;
    const digest = keccak256(
      encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, type, { type: 'uint256' }],
        [BigInt(await client.getChainId()), runtime.address, donor.account.address, ctx, amount]
      )
    );
    const proof = await attestor.signMessage({ message: { raw: digest } });
    await rejects(gifts.write.musicGiftContribute([ctx, q.digest, '0x'], { account: donor.account, value: amount }), 'proof length');
    await rejects(gifts.write.musicGiftContribute([ctx, q.digest, proof], { account: host.account, value: amount }), 'invalid room proof');
    const before = await Promise.all([host, collaborator, cause].map(({ account }) => client.getBalance({ address: account.address })));
    await gifts.write.musicGiftContribute([ctx, q.digest, proof], { account: donor.account, value: amount });
    const after = await Promise.all([host, collaborator, cause].map(({ account }) => client.getBalance({ address: account.address })));
    expect(after.map((balance, i) => balance - before[i])).to.deep.equal([parseEther('2'), parseEther('2.4'), parseEther('5.6')]);
  });
  it('expires scheduled allocations and timestamps receipts using block time', async () => {
    const { gifts, context, donor, cause, client, artist } = await loadFixture(fixture);
    const end = BigInt((await time.latest()) + 60);
    await gifts.write.musicGiftSetPolicy([zeroHash, { ...policy, endsAt: end, recipients: [cause.account.address], shares: [10000] }]);
    const gift = { ...context, contentHash: zeroHash };
    const before = await gifts.read.musicGiftQuote([gift, 1000n]);
    await time.increaseTo(end);
    const after = await gifts.read.musicGiftQuote([gift, 1000n]);
    expect(after.digest).not.to.equal(before.digest);
    expect(after.recipients.map(address => address.toLowerCase())).to.deep.equal([artist.account.address]);
    const tx = await gifts.write.musicGiftContribute([gift, after.digest, '0x'], { account: donor.account, value: 1000n });
    const receipt = await client.getTransactionReceipt({ hash: tx });
    const events = await gifts.getEvents.ContributionReceived({}, { fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber });
    expect(events[0].args.timestamp).to.equal((await client.getBlock({ blockNumber: receipt.blockNumber })).timestamp);
  });
  it('isolates a rejected destination and keeps its amount claimable per receipt', async () => {
    const { gifts, context, donor } = await loadFixture(fixture);
    const recipient = await hre.viem.deployContract('RejectingRoyaltyRecipient');
    await gifts.write.musicGiftSetPolicy([zeroHash, { ...policy, recipients: [recipient.address], shares: [10000] }]);
    const gift = { ...context, contentHash: zeroHash };
    const q = await gifts.read.musicGiftQuote([gift, 1000n]);
    await gifts.write.musicGiftContribute([gift, q.digest, '0x'], { account: donor.account, value: 1000n });
    const id = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }], [donor.account.address, context.intentId]));
    expect(await gifts.read.musicGiftPending([id, recipient.address])).to.equal(1000n);
    await rejects(gifts.write.musicGiftClaim([id], { account: donor.account }), 'nothing to claim');
  });
  it('lets only a failed recipient recover its own share once, separately from royalties', async () => {
    const { gifts, context, donor, runtime, client } = await loadFixture(fixture);
    const recipient = await hre.viem.deployContract('GasConsumingRoyaltyRecipient');
    await gifts.write.musicGiftSetPolicy([zeroHash, { ...policy, recipients: [recipient.address], shares: [10000] }]);
    const gift = { ...context, contentHash: zeroHash };
    const q = await gifts.read.musicGiftQuote([gift, 1000n]);
    await gifts.write.musicGiftContribute([gift, q.digest, '0x'], { account: donor.account, value: 1000n });
    const id = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }], [donor.account.address, context.intentId]));
    await rejects(recipient.write.claimContribution([runtime.address, id]), 'recipient rejected claim');
    expect(await gifts.read.musicGiftPending([id, recipient.address])).to.equal(1000n);
    const royalty = await hre.viem.getContractAt('MusicRoyaltiesPallet', runtime.address);
    expect(await royalty.read.musicRoyClaimable([recipient.address])).to.equal(0n);
    await recipient.write.setBurnGas([false]);
    await recipient.write.claimContribution([runtime.address, id]);
    expect(await gifts.read.musicGiftPending([id, recipient.address])).to.equal(0n);
    expect(await client.getBalance({ address: recipient.address })).to.equal(1000n);
    await rejects(recipient.write.claimContribution([runtime.address, id]), 'nothing to claim');
  });
});
