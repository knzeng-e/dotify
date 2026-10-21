import { it } from 'node:test';
import assert from 'node:assert/strict';
import { cdmSnapshotVersion } from './cdm-snapshot-version.mjs';
const address = '0x' + 'ab'.repeat(20),
  library = '@dotify/synthetic';
it('retains actual registry versions, including zero, instead of inventing version one', () => {
  for (const version of [0, 2, 19])
    assert.equal(cdmSnapshotVersion({ contracts: { [library]: { address: address.toUpperCase(), version } } }, library, address), version);
});
it('refuses stale or missing address/version pairs', () => {
  for (const entry of [
    undefined,
    { address: '0x' + '12'.repeat(20), version: 2 },
    { address, version: -1 },
    { address, version: NaN },
    { address, version: 2 ** 32 },
    { address, version: '2' }
  ])
    assert.throws(() => cdmSnapshotVersion({ contracts: { [library]: entry } }, library, address), /Refresh the finalized/);
});
