import { expect } from 'chai';
import hre from 'hardhat';
import { decodeFunctionData, keccak256, toBytes, zeroAddress, type Abi, type Address, type Hex } from 'viem';
import {
  FACET_CUT_REPLACE,
  MUSIC_REGISTRY_REGISTER_SELECTOR,
  assertRegistryArtifact,
  buildRegistryHotfixCalldata,
  isRegistryRuntimeSafe,
  registryUpgradePlanDigest
} from '../scripts/registryUpgrade';

const runtime = '0x1111111111111111111111111111111111111111' as Address;
const targetFacet = '0x2222222222222222222222222222222222222222' as Address;

describe('Registry remediation tooling', () => {
  it('derives the complete registry selector inventory and pins musicRegRegister', async () => {
    const artifact = await hre.artifacts.readArtifact('MusicRegistryPallet');
    const selectors = assertRegistryArtifact(artifact.abi as Abi);

    expect(selectors).to.have.lengthOf(10);
    expect(selectors.find(entry => entry.name === 'musicRegRegister')?.selector).to.equal(MUSIC_REGISTRY_REGISTER_SELECTOR);
  });

  it('encodes a minimal one-selector Replace cut with no initializer', async () => {
    const artifact = await hre.artifacts.readArtifact('DiamondCutPallet');
    const data = buildRegistryHotfixCalldata(artifact.abi as Abi, targetFacet);
    const decoded = decodeFunctionData({ abi: artifact.abi as Abi, data });
    const [cuts, init, initCalldata] = decoded.args as readonly [
      readonly [{ facetAddress: Address; action: number; functionSelectors: readonly Hex[] }],
      Address,
      Hex
    ];

    expect(decoded.functionName).to.equal('diamondCut');
    expect(cuts).to.have.lengthOf(1);
    expect(cuts[0].facetAddress.toLowerCase()).to.equal(targetFacet.toLowerCase());
    expect(cuts[0].action).to.equal(FACET_CUT_REPLACE);
    expect(cuts[0].functionSelectors).to.deep.equal([MUSIC_REGISTRY_REGISTER_SELECTOR]);
    expect(init).to.equal(zeroAddress);
    expect(initCalldata).to.equal('0x');
  });

  it('keeps owner confirmation stable across blocks but binds security-relevant state', () => {
    const body = {
      capturedBlockNumber: '100',
      capturedBlockHash: keccak256(toBytes('block-100')),
      runtime,
      owner: '0x3333333333333333333333333333333333333333' as Address,
      targetFacet,
      trackStateHash: keccak256(toBytes('catalogue-state')),
      transaction: { to: runtime, value: '0x0', data: '0x1234' as Hex }
    };

    const first = registryUpgradePlanDigest(body);
    expect(registryUpgradePlanDigest({ ...body, capturedBlockNumber: '101', capturedBlockHash: keccak256(toBytes('block-101')) })).to.equal(first);
    expect(registryUpgradePlanDigest({ ...body, trackStateHash: keccak256(toBytes('changed-catalogue')) })).to.not.equal(first);
  });

  it('fails runtime safety closed on bytecode, owner, guard, track, or route anomalies', () => {
    const protectedAudit = {
      registerFacetMatchesSource: true,
      ownerMatchesDirectoryArtist: true,
      guardStatus: 'protected' as const,
      foreignTrackCount: 0,
      selectorRoutes: Array.from({ length: 10 }, () => ({ facet: targetFacet, codeHash: keccak256(toBytes('facet')) }))
    };

    expect(isRegistryRuntimeSafe(protectedAudit, 10)).to.equal(true);
    expect(isRegistryRuntimeSafe({ ...protectedAudit, registerFacetMatchesSource: false }, 10)).to.equal(false);
    expect(isRegistryRuntimeSafe({ ...protectedAudit, ownerMatchesDirectoryArtist: false }, 10)).to.equal(false);
    expect(isRegistryRuntimeSafe({ ...protectedAudit, guardStatus: 'inconclusive' }, 10)).to.equal(false);
    expect(isRegistryRuntimeSafe({ ...protectedAudit, foreignTrackCount: 1 }, 10)).to.equal(false);
    expect(isRegistryRuntimeSafe({ ...protectedAudit, selectorRoutes: protectedAudit.selectorRoutes.slice(1) }, 10)).to.equal(false);
    expect(
      isRegistryRuntimeSafe(
        { ...protectedAudit, selectorRoutes: [{ ...protectedAudit.selectorRoutes[0], codeHash: null }, ...protectedAudit.selectorRoutes.slice(1)] },
        10
      )
    ).to.equal(false);
  });
});
