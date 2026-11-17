// Public captured fixture only; never opens a network source, signer or key.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createBulletinRpcTransport } from '../src/services/bulletinTransport.js';
import { rpcFixture, fixture, codecs } from '../src/services/bulletinTransport.fixture.js';

assert.equal(process.argv.length, 2, 'No inputs: this probe only replays the public fixture');
const f = rpcFixture();
const owner = new AbortController();
let canonical = 0,
  arrived,
  release;
const allCanonical = new Promise(resolve => (arrived = resolve));
const body = new Promise(resolve => (release = resolve));
const timeout = setTimeout(() => {
  owner.abort(new Error('Public proof probe timed out'));
  arrived();
  release();
}, 5000);
try {
  const transport = createBulletinRpcTransport({
    identity: fixture.identity,
    request: async (method, params, signal) => {
      if (method === 'chain_getBlockHash' && params[0] === fixture.receipt.block && ++canonical === 4) arrived();
      if (method === 'chain_getBlock') await body;
      return f.request(method, params, signal);
    }
  });
  const pending = Array.from({ length: 4 }, () => transport.lookupSubmission(fixture.query, owner.signal));
  await allCanonical;
  await new Promise(resolve => setImmediate(resolve));
  release();
  for (const value of await Promise.all(pending)) assert.deepEqual(value, fixture.receipt);
  const events = codecs.builder.buildStorage('System', 'Events').keys.enc();
  const retention = codecs.builder.buildStorage('TransactionStorage', 'RetentionPeriod').keys.enc();
  const source = await readFile(new URL('../src/services/bulletinTransport.ts', import.meta.url));
  console.log(
    JSON.stringify(
      {
        schema: 'dotify.bulletin.cold-proof-counter.v1',
        moduleSha256: createHash('sha256').update(source).digest('hex'),
        confirmations: 4,
        bodyFetches: f.calls.filter(c => c.method === 'chain_getBlock').length,
        eventFetches: f.calls.filter(c => c.method === 'state_getStorage' && c.params[0] === events).length,
        canonicalMappings: canonical,
        finalizedHeadReads: f.calls.filter(c => c.method === 'chain_getFinalizedHead').length,
        retentionReads: f.calls.filter(c => c.method === 'state_getStorage' && c.params[0] === retention).length,
        totalRpcCalls: f.calls.length,
        networkUsed: false,
        newTransactionsSubmitted: 0,
        liveLatencyAccepted: false
      },
      null,
      2
    )
  );
} finally {
  clearTimeout(timeout);
  owner.abort();
  release();
}
