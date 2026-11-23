import assert from 'node:assert/strict';
const zeroAddress = `0x${'0'.repeat(40)}`;

export const ASSET_HUB_GENESIS = '0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2';
const address = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) && value.toLowerCase() !== zeroAddress;
const hash = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

/** Selected-artist state, not global pending-runtime enumeration or publication authority.
 * Both providers are trusted RPCs. No event-log absence is used as evidence.
 */
export async function inspectArtistOnboarding({ publicKey, deployment, packages }, deps) {
  assert.ok(hash(publicKey) && !/^0x0{64}$/i.test(publicKey), 'Supply the intended nonzero Product public key');
  const palletNames = ['cutPallet', 'loupePallet', 'ownershipPallet', 'registryPallet', 'royaltiesPallet', 'accessPallet', 'metadataPallet'];
  assert.deepEqual(Object.keys(deployment.pallets).sort(), palletNames.sort(), 'Require all seven fresh implementations');
  for (const value of [deployment.factory, deployment.directory, deployment.initializer, ...Object.values(deployment.pallets)])
    assert.ok(address(value), 'Invalid fresh deployment address');
  assert.ok(
    Number.isInteger(deployment.nativeTokenDecimals) && deployment.nativeTokenDecimals >= 0 && deployment.nativeTokenDecimals <= 18,
    'Invalid native precision'
  );
  const call = async (fn, ...args) => {
    deps.signal?.throwIfAborted();
    const result = await fn(...args);
    deps.signal?.throwIfAborted();
    return result;
  };
  const artist = deps.deriveH160(publicKey);
  assert.ok(address(artist), 'Invalid derived artist address');
  const anchor = await call(deps.nativeSnapshot, artist);
  assert.equal(anchor.genesis, ASSET_HUB_GENESIS, 'Unexpected native genesis');
  assert.ok(Number.isSafeInteger(anchor.number) && anchor.number > 0 && hash(anchor.hash), 'Invalid finalized native block');
  assert.ok(same(anchor.mappedPublicKey, publicKey), 'The finalized native mapping does not match the selected Product key');
  assert.equal(await call(deps.chainId), 420420417, 'Unexpected EVM chain');
  const block = await call(deps.block, anchor.number);
  assert.ok(same(block.hash, anchor.hash) && block.number === BigInt(anchor.number), 'Native and EVM block references disagree');
  const read = (target, name, args = []) => call(deps.read, target, name, args, BigInt(anchor.number));
  const code = async target => {
    const bytes = await call(deps.code, target, BigInt(anchor.number));
    assert.ok(typeof bytes === 'string' && /^0x(?:[0-9a-f]{2})+$/i.test(bytes), 'Missing contract code');
    return deps.hashCode(bytes);
  };
  const codeHashes = {};
  for (const target of [deployment.factory, deployment.directory, deployment.initializer, ...Object.values(deployment.pallets)])
    codeHashes[target] = await code(target);
  for (const [name, expected] of Object.entries({ directory: deployment.directory, initContract: deployment.initializer, ...deployment.pallets }))
    assert.ok(same(await read(deployment.factory, name), expected), `Factory ${name} mismatch`);
  assert.equal(await read(deployment.factory, 'nativeTokenDecimals'), deployment.nativeTokenDecimals, 'Factory native precision mismatch');
  assert.ok(same(await read(deployment.directory, 'factory'), deployment.factory), 'Directory/factory pairing mismatch');
  assert.ok(Array.isArray(packages) && packages.length === 2, 'Require both exact CDM packages');
  for (const [name, target] of [
    ['@dotify/artist-directory', deployment.directory],
    ['@dotify/artist-runtime-factory', deployment.factory]
  ]) {
    const matches = packages.filter(entry => entry.name === name);
    assert.equal(matches.length, 1, 'Duplicate or missing CDM package');
    const entry = matches[0];
    assert.ok(same(entry.address, target) && Number.isInteger(entry.version) && entry.version >= 0 && entry.version <= 0xffffffff, 'Invalid CDM binding');
    const resolved = await call(deps.cdm, name, entry.version, BigInt(anchor.number));
    assert.ok(resolved.isSome === true && same(resolved.value, target), 'Exact finalized CDM binding mismatch');
  }
  const registered = await read(deployment.directory, 'runtimeOf', [artist]);
  const pending = await read(deployment.factory, 'pendingRuntimeOf', [artist]);
  const stage = await read(deployment.factory, 'pendingRuntimeStageOf', [artist]);
  assert.ok(registered === zeroAddress || address(registered), 'Malformed registered runtime');
  assert.ok(pending === zeroAddress || address(pending), 'Malformed pending runtime');
  assert.ok(Number.isInteger(stage) && stage >= 0 && stage <= 7, 'Malformed bootstrap stage');
  assert.ok(!(registered !== zeroAddress && pending !== zeroAddress), 'Conflicting registered and pending runtimes');
  assert.equal(pending === zeroAddress, stage === 0, 'Inconsistent pending runtime/stage');
  const runtime = pending !== zeroAddress ? pending : registered !== zeroAddress ? registered : null;
  if (runtime) codeHashes[runtime] = await code(runtime);
  return {
    schema: 'dotify.artist-onboarding-prerequisites.v1',
    chainId: 420420417,
    genesis: anchor.genesis,
    blockNumber: anchor.number,
    blockHash: anchor.hash,
    // Deliberately omit the raw public key, mapping and native balance.
    accountFingerprint: deps.fingerprint(publicKey),
    artist,
    factory: deployment.factory,
    directory: deployment.directory,
    nativeTokenDecimals: deployment.nativeTokenDecimals,
    packages,
    state: pending !== zeroAddress ? 'pending' : registered !== zeroAddress ? 'registered' : 'absent',
    runtime,
    completedStage: stage,
    remainingApprovals: pending !== zeroAddress ? 8 - stage : registered !== zeroAddress ? 0 : 8,
    codeHashes,
    boundaries: {
      selectedArtistOnly: true,
      nativeMappingVerified: true,
      globalPendingDiscoveryComplete: false,
      reviewedBytecodeVerified: false,
      signerControlVerified: false,
      runtimeAuthorityVerified: false,
      publicationEnabled: false,
      transactionSubmitted: false
    }
  };
}
