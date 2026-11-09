import assert from 'node:assert/strict';
import { readFile, open } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const { values } = parseArgs({
  options: {
    live: { type: 'boolean' },
    help: { type: 'boolean' },
    'baseline-source': { type: 'string' },
    'candidate-source': { type: 'string' },
    endpoint: { type: 'string' },
    genesis: { type: 'string' },
    account: { type: 'string' },
    cid: { type: 'string' },
    output: { type: 'string' }
  }
});
if (values.help) {
  console.log(
    'Read-only comparison: node --import tsx scripts/compare-bulletin-reads.mjs --live --baseline-source PATH --candidate-source PATH --endpoint wss://HOST --genesis 0xHASH --account SS58 --cid CID --output NEW_FILE'
  );
  process.exit(0);
}
assert.equal(values.live, true, 'Network reads require explicit --live');
for (const name of ['baseline-source', 'candidate-source', 'endpoint', 'genesis', 'account', 'cid', 'output']) assert(values[name], 'Missing --' + name);
const endpoint = new URL(values.endpoint);
assert(
  endpoint.protocol === 'wss:' && !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash,
  'Use an explicit credential-free wss endpoint'
);
const identity = { genesis: values.genesis, account: values.account },
  cid = values.cid;
// Import only reviewed source worktrees. No environment signer/profile is read.
const baselinePath = resolve(values['baseline-source']),
  candidatePath = resolve(values['candidate-source']);
const baselineModule = await import(pathToFileURL(baselinePath).href),
  candidateModule = await import(pathToFileURL(candidatePath).href);
const baseline = baselineModule.createBulletinRpcTransport,
  candidate = candidateModule.createBulletinRpcTransport;
assert.equal(typeof baseline, 'function');
assert.equal(typeof candidate, 'function');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = { baselineSha256: digest(await readFile(baselinePath)), candidateSha256: digest(await readFile(candidatePath)) };
const inputsSha256 = digest(JSON.stringify({ endpoint: endpoint.href, identity, cid }));
// Never overwrite a prior report or custody file; no output directory is created.
const output = await open(values.output, 'wx', 0o600);
const allowed = new Set([
  'chain_getBlockHash',
  'chain_getFinalizedHead',
  'chain_getHeader',
  'state_getStorageHash',
  'state_call',
  'state_getStorage',
  'bitswap_v1_get'
]);
let client;
const owner = new AbortController();
let pending = 0,
  current,
  closed = false;
const close = () => {
  if (!closed) {
    closed = true;
    client?.destroy();
  }
};
let timeout;
const request = async (method, params, signal) => {
  assert(allowed.has(method), 'Writes are unavailable in this probe');
  if (method === 'state_call') assert(['Metadata_metadata_at_version', 'BulletinTransactionStorageApi_account_authorization'].includes(params[0]));
  signal.throwIfAborted();
  assert(current);
  current.calls[method] = (current.calls[method] || 0) + 1;
  current.peakPendingRpcs = Math.max(current.peakPendingRpcs, ++pending);
  let abort = () => {};
  try {
    return await Promise.race([
      client._request(method, params),
      new Promise((_, reject) => {
        abort = () => {
          close();
          reject(signal.reason);
        };
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      })
    ]);
  } finally {
    pending--;
    signal.removeEventListener('abort', abort);
  }
};
const samples = [];
try {
  const { createClient } = await import('polkadot-api');
  const { getWsProvider } = await import('polkadot-api/ws');
  client = createClient(getWsProvider(endpoint.href));
  timeout = setTimeout(() => {
    owner.abort(new Error('Read-only comparison deadline'));
    close();
  }, 90000);
  const transports = { baseline: baseline({ identity, request }), candidate: candidate({ identity, request }) };
  for (let pair = 0; pair < 6; pair++)
    for (const version of pair % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
      assert.equal(pending, 0);
      current = { pair: pair + 1, version, cache: pair === 0 ? 'transport-metadata-cold' : 'transport-metadata-warm', calls: {}, peakPendingRpcs: 0 };
      const start = performance.now(),
        transport = transports[version];
      assert.equal(transport.writable, false);
      const status = await transport.status(owner.signal),
        receipt = await transport.lookup(cid, owner.signal),
        bytes = await transport.readBlock(cid, owner.signal);
      assert(receipt && bytes.length === receipt.bytes);
      assert.equal(pending, 0);
      samples.push({ ...current, elapsedMs: Math.round(performance.now() - start), head: status.head, bytes: bytes.length });
    }
  const result = {
    observedAt: new Date().toISOString(),
    scope: 'Interleaved read-only status + retained CID lookup + CID-verified bytes; not a store/finality or publication benchmark',
    clientNetwork: 'not measured',
    sources,
    inputsSha256,
    samples,
    networkWrites: 0,
    signerUsed: false
  };
  await output.writeFile(JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ report: values.output, samples: samples.length, networkWrites: 0, signerUsed: false }));
} finally {
  clearTimeout(timeout);
  close();
  await output.close();
}
