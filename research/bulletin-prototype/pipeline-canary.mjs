// Opt-in manual operator only. No environment signer, hidden fallback or automatic live CI.
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from 'polkadot-api';
import { getWsProvider } from 'polkadot-api/ws';
import { loadFixture, localSigner, withLease } from './canary.mjs';
import { planPipeline } from './pipeline-plan.mjs';
import { publishPipelined, pipelineLimits } from './pipeline.mjs';
import { nonceTransport } from './nonce-transport.mjs';
import { withAccountLease } from './operator-lease.mjs';
import { ENDPOINT, CANARY_ACCOUNT, CANARY_BUDGET } from './live-transport.mjs';
export function parseArguments(argv) {
  const [command, input, ...rest] = argv;
  assert.ok(
    ['plan', 'check', 'publish', 'reconcile'].includes(command) && input,
    'Usage: pipeline-canary.mjs plan|check|publish|reconcile PRIVATE_DIRECTORY [--concurrency 1..4] [--exclusive-account --signer-fd N]'
  );
  const result = { command, directory: resolve(input), concurrency: 2, signerFd: undefined, exclusive: false };
  const seen = new Set();
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    assert.ok(!seen.has(flag), 'Repeated option');
    seen.add(flag);
    if (flag === '--exclusive-account') {
      result.exclusive = true;
      continue;
    }
    assert.ok(['--concurrency', '--signer-fd'].includes(flag) && /^\d+$/.test(rest[i + 1] ?? ''), 'Invalid pipeline option');
    const value = Number(rest[++i]);
    if (flag === '--concurrency') result.concurrency = value;
    else {
      assert.ok(Number.isSafeInteger(value) && value >= 3, 'Private signer descriptor required');
      result.signerFd = value;
    }
  }
  pipelineLimits(result);
  assert.ok(
    command === 'publish' ? result.exclusive && result.signerFd !== undefined : !result.exclusive && result.signerFd === undefined,
    'Publish requires --exclusive-account and --signer-fd; read-only commands never admit a signer'
  );
  return result;
}
export async function main(argv) {
  const args = parseArguments(argv),
    fixture = await loadFixture(args.directory);
  const plan = await planPipeline(fixture.graph, args);
  if (args.command === 'plan') return plan;
  const run = () =>
    withLease(args.directory, async () => {
      const signer = args.command === 'publish' ? localSigner(args.signerFd) : null;
      const client = createClient(getWsProvider(ENDPOINT));
      const watchdog = setTimeout(() => {
        console.error('Pipeline exceeded 30 minutes; preserve leases and reconcile all intents before retrying.');
        process.exit(2);
      }, 30 * 60_000);
      try {
        const transport = nonceTransport(client, signer, CANARY_ACCOUNT);
        const before = await transport.status();
        let result;
        if (args.command === 'check') {
          const auth = before.authorization;
          assert.ok(
            auth.remainingTransactions >= fixture.graph.blocks.length * 2 &&
              auth.remainingBytes >= BigInt(fixture.graph.bytes) &&
              auth.remainingRenewBytes >= BigInt(fixture.graph.bytes),
            'Quota does not cover stores plus one renewal'
          );
          result = {
            quotaAndNonceAvailable: true,
            pendingOutcomesNotChecked: true,
            plan,
            finalizedAccountNonce: await transport.nextNonce(),
            budget: CANARY_BUDGET
          };
        } else result = await publishPipelined(fixture.graph, transport, join(args.directory, 'pipeline-checkpoint'), CANARY_BUDGET, args);
        return {
          observedAt: new Date().toISOString(),
          command: args.command,
          endpoint: ENDPOINT,
          genesis: transport.genesis,
          account: CANARY_ACCOUNT,
          root: fixture.graph.root,
          before,
          result,
          after: await transport.status(),
          attemptedTransactions: transport.attemptedTransactions
        };
      } finally {
        clearTimeout(watchdog);
        client.destroy();
      }
    });
  return args.command === 'publish' ? withAccountLease(run) : run();
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(JSON.stringify(await main(process.argv.slice(2)), (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  } catch (error) {
    console.error(String(error.message).slice(0, 500));
    process.exitCode = 1;
  }
}
