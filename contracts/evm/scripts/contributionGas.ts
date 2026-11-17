/** Local-only, deterministic comparison. Never sends transactions to a public network. */
import hre from 'hardhat';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { encodeAbiParameters, keccak256, toBytes, toFunctionSelector, zeroAddress, zeroHash, type Abi, type AbiFunction, type Hash } from 'viem';

async function main() {
  if (hre.network.name !== 'hardhat') throw new Error('Gas measurements require the ephemeral Hardhat network.');
  await hre.network.provider.send('evm_setNextBlockTimestamp', [2_000_000_000]);
  await hre.network.provider.send('evm_mine');
  const client = await hre.viem.getPublicClient();
  const wallets = await hre.viem.getWalletClients();
  const [artist, donor, collaborator, host, attestor] = wallets;
  const baseline = process.env.CONTRIBUTION_BASELINE_ARTIFACT ? JSON.parse(readFileSync(process.env.CONTRIBUTION_BASELINE_ARTIFACT, 'utf8')) : null;
  const facets = [];
  for (const name of ['DiamondCutPallet', 'MusicRegistryPallet', 'MusicRoyaltiesPallet', 'MusicAccessPallet']) {
    if (name === 'MusicRoyaltiesPallet' && baseline) {
      assert.equal(baseline.contractName, name);
      const hash = await artist.deployContract({ abi: baseline.abi, bytecode: baseline.bytecode });
      const receipt = await client.waitForTransactionReceipt({ hash });
      assert.ok(receipt.contractAddress);
      facets.push(await hre.viem.getContractAt('MusicRoyaltiesPallet', receipt.contractAddress));
    } else facets.push(await hre.viem.deployContract(name));
  }
  const selectors = (abi: Abi) => abi.filter((item): item is AbiFunction => item.type === 'function').map(toFunctionSelector);
  const runtime = await hre.viem.deployContract('SmartRuntime', [
    artist.account.address,
    facets.map(facet => ({ facetAddress: facet.address, action: 0, functionSelectors: selectors(facet.abi) })),
    zeroAddress,
    '0x'
  ]);
  const registry = await hre.viem.getContractAt('MusicRegistryPallet', runtime.address);
  const gifts = await hre.viem.getContractAt('MusicContributionsPallet', runtime.address);
  const royalties = await hre.viem.getContractAt('MusicRoyaltiesPallet', runtime.address);
  const work = keccak256(toBytes('gas-work'));
  const metrics: Record<string, string> = {};
  const quotes: Record<string, unknown> = {};
  const record = async (name: string, transaction: Promise<Hash>) => {
    const receipt = await client.waitForTransactionReceipt({ hash: await transaction });
    metrics[name] = receipt.gasUsed.toString();
  };
  await registry.write.musicRegRegister([
    {
      contentHash: work,
      title: 'Gas work',
      artistName: 'Artist',
      description: 'Fixture',
      imageRef: 'ipfs://cover',
      audioRef: 'ipfs://audio',
      metadataRef: 'ipfs://metadata',
      artistContractRef: 'rights',
      accessMode: 1,
      pricePlanck: 10000n,
      requiredPersonhood: 0
    },
    [artist.account.address, collaborator.account.address],
    [7000, 3000]
  ]);
  const empty = {
    version: 0n,
    startsAt: 0n,
    endsAt: 0n,
    hostBps: 0,
    roomAttestor: zeroAddress,
    campaign: zeroHash,
    description: '',
    recipients: [],
    shares: []
  };
  const context = {
    contentHash: work,
    intentId: keccak256(toBytes('gas-intent')),
    host: zeroAddress,
    room: zeroHash,
    expiresAt: 2_000_001_000n
  };
  metrics.policyReadEstimate = (
    await client.estimateContractGas({ address: runtime.address, abi: gifts.abi, functionName: 'musicGiftPolicy', args: [work], account: donor.account })
  ).toString();
  metrics.directTipQuoteEstimate = (
    await client.estimateContractGas({
      address: runtime.address,
      abi: gifts.abi,
      functionName: 'musicGiftQuote',
      args: [context, 10000n],
      account: donor.account
    })
  ).toString();
  let quote = await gifts.read.musicGiftQuote([context, 10000n]);
  quotes.direct = quote;
  await record('directTip', gifts.write.musicGiftContribute([context, quote.digest, '0x'], { account: donor.account, value: 10000n }));
  await record('classicAccess', royalties.write.musicRoyPayAccess([work], { account: donor.account, value: 10000n }));
  await record('setHostPolicy', gifts.write.musicGiftSetPolicy([work, { ...empty, hostBps: 1000, roomAttestor: attestor.account.address }]));
  const roomContext = { ...context, intentId: keccak256(toBytes('room-intent')), host: host.account.address, room: keccak256(toBytes('gas-room')) };
  quote = await gifts.read.musicGiftQuote([roomContext, 10000n]);
  quotes.room = quote;
  const contextType = {
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
      [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, contextType, { type: 'uint256' }],
      [BigInt(await client.getChainId()), runtime.address, donor.account.address, roomContext, 10000n]
    )
  );
  const proof = await attestor.signMessage({ message: { raw: digest } });
  await record('roomTip', gifts.write.musicGiftContribute([roomContext, quote.digest, proof], { account: donor.account, value: 10000n }));
  const recipients = wallets.slice(4, 20).map(wallet => wallet.account.address);
  await record('set16Destinations', gifts.write.musicGiftSetPolicy([zeroHash, { ...empty, recipients, shares: recipients.map(() => 625) }]));
  const gift = { ...context, contentHash: zeroHash, intentId: keccak256(toBytes('gift-intent')) };
  metrics.gift16QuoteEstimate = (
    await client.estimateContractGas({ address: runtime.address, abi: gifts.abi, functionName: 'musicGiftQuote', args: [gift, 10000n], account: donor.account })
  ).toString();
  quote = await gifts.read.musicGiftQuote([gift, 10000n]);
  quotes.gift16 = quote;
  await record('gift16Destinations', gifts.write.musicGiftContribute([gift, quote.digest, '0x'], { account: donor.account, value: 10000n }));
  const artifact = await hre.artifacts.readArtifact('MusicRoyaltiesPallet');
  metrics.royaltiesRuntimeBytes = String((artifact.deployedBytecode.length - 2) / 2);
  const sourceHashes = Object.fromEntries(
    ['pallets/MusicContributionsPallet.sol', 'pallets/MusicRoyaltiesPallet.sol', 'libraries/LibMusicRoyalties.sol'].map(file => [
      file,
      createHash('sha256')
        .update(readFileSync(`contracts/${file}`))
        .digest('hex')
    ])
  );
  let upgrade;
  if (baseline) {
    const recipient = await hre.viem.deployContract('GasConsumingRoyaltyRecipient');
    await gifts.write.musicGiftSetPolicy([zeroHash, { ...empty, version: 1n, recipients: [recipient.address], shares: [10000] }]);
    const pendingContext = { ...gift, intentId: keccak256(toBytes('pending-intent')) };
    const pendingQuote = await gifts.read.musicGiftQuote([pendingContext, 10000n]);
    await gifts.write.musicGiftContribute([pendingContext, pendingQuote.digest, '0x'], { account: donor.account, value: 10000n });
    const id = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'bytes32' }], [donor.account.address, pendingContext.intentId]));
    const beforePolicy = await gifts.read.musicGiftPolicy([zeroHash]);
    const beforeWorkPolicy = await gifts.read.musicGiftPolicy([work]);
    const beforeTrack = await registry.read.musicRegGetTrack([work]);
    assert.equal(await gifts.read.musicGiftPending([id, recipient.address]), 10000n);
    const next = await hre.viem.deployContract('MusicRoyaltiesPallet');
    assert.deepEqual(selectors(baseline.abi).sort(), selectors(next.abi).sort());
    const cut = await hre.viem.getContractAt('DiamondCutPallet', runtime.address);
    await cut.write.diamondCut([[{ facetAddress: next.address, action: 1, functionSelectors: selectors(next.abi) }], zeroAddress, '0x']);
    assert.deepEqual(await gifts.read.musicGiftPolicy([zeroHash]), beforePolicy);
    assert.deepEqual(await gifts.read.musicGiftPolicy([work]), beforeWorkPolicy);
    assert.deepEqual(await registry.read.musicRegGetTrack([work]), beforeTrack);
    const access = await hre.viem.getContractAt('MusicAccessPallet', runtime.address);
    assert.equal(await access.read.musicAccHasPaid([work, donor.account.address]), true);
    assert.equal(await gifts.read.musicGiftPending([id, recipient.address]), 10000n);
    await assert.rejects(
      gifts.write.musicGiftContribute([pendingContext, pendingQuote.digest, '0x'], { account: donor.account, value: 10000n }),
      /ContributionAlreadySubmitted/
    );
    await recipient.write.setBurnGas([false]);
    await recipient.write.claimContribution([runtime.address, id]);
    assert.equal(await gifts.read.musicGiftPending([id, recipient.address]), 0n);
    assert.equal(await client.getBalance({ address: recipient.address }), 10000n);
    await assert.rejects(recipient.write.claimContribution([runtime.address, id]), /ContributionNothingToClaim/);
    upgrade = {
      baselineBytecodeHash: keccak256(baseline.deployedBytecode),
      policiesPreserved: true,
      catalogPreserved: true,
      paidAccessPreserved: true,
      replayBlocked: true,
      pendingRecoveredExactlyOnce: true
    };
  }
  if (process.env.CONTRIBUTION_GAS_BASELINE_REPORT && !baseline) {
    const previous = JSON.parse(readFileSync(process.env.CONTRIBUTION_GAS_BASELINE_REPORT, 'utf8'));
    const normalized = JSON.parse(JSON.stringify(quotes, (_, value) => (typeof value === 'bigint' ? value.toString() : value)));
    assert.deepEqual(normalized, previous.quotes, 'Optimization changed a recipient-level quote or its digest');
  }
  const report = {
    compiler: 'solc 0.8.28, viaIR, optimizer runs 200',
    network: hre.network.name,
    mode: baseline ? 'baseline-upgrade-rehearsal' : 'gas',
    sourceHashes,
    metrics,
    quotes,
    upgrade
  };
  const json = JSON.stringify(report, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2) + '\n';
  console.log(json);
  if (process.env.CONTRIBUTION_GAS_REPORT) writeFileSync(process.env.CONTRIBUTION_GAS_REPORT, json);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
