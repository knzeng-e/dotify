// Local preparation and budget inspection only. This command cannot load a signer or write to a network.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepare, loadFixture } from './canary.mjs';
import { encryptedContinuityFixture } from './aac-fixture.mjs';
import { prepareReaddressedAac } from './readdress-aac.mjs';
import { buildMobile } from './mobile-package.mjs';
import { fixtureProfile } from './fixture-profile.mjs';
const options = Object.freeze({ profile: 'continuity' });
export async function main(argv) {
  const [command, input, output, ...extra] = argv;
  assert.ok(
    ['prepare', 'plan', 'build'].includes(command) && input,
    'Usage: continuity.mjs prepare NEW_SOURCE NEW_BLAKE | plan PRIVATE_BLAKE | build PRIVATE_BLAKE NEW_OUTPUT --allow-public-generated-key'
  );
  if (command === 'prepare') {
    assert.ok(output && !extra.length, 'Two new private directories required');
    await prepare(resolve(input), encryptedContinuityFixture, options);
    return { ...(await prepareReaddressedAac(resolve(input), resolve(output), options)), networkWrites: 0, signerUsed: false };
  }
  if (command === 'build') {
    assert.ok(output && extra.length === 1 && extra[0] === '--allow-public-generated-key', 'Explicit generated-key acknowledgement required');
    return buildMobile(resolve(input), resolve(output), { ...options, acknowledgePublicTestKey: true });
  }
  assert.ok(!output && !extra.length, 'Plan takes only the private fixture directory');
  const fixture = await loadFixture(resolve(input), options),
    profile = fixtureProfile(options.profile);
  return {
    profile: profile.id,
    root: fixture.graph.root,
    durationSeconds: profile.durationSeconds,
    bitratesKbps: [96, 160, 320],
    stores: fixture.graph.blocks.length,
    bytes: fixture.graph.bytes,
    oneRenewalReserve: { transactions: fixture.graph.blocks.length, bytes: fixture.graph.bytes },
    limits: profile.budget,
    networkWrites: 0,
    signerUsed: false,
    distributionBudgetIncluded: false,
    nativeCacheState: 'unknown; new root is not proof of cleared Host caches'
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await main(process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error(String(error.message).slice(0, 500));
    process.exitCode = 1;
  }
}
