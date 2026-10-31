import { runProtected, protectedStage } from './protected-operator.mjs';
try {
  const result = await runProtected(process.argv.slice(2));
  console.log(JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
} catch {
  // Never echo arbitrary provider/signer exceptions or raw request payloads.
  console.error(
    `Protected canary stopped during ${protectedStage()}. Preserve custody and publication journals; inspect plan/check, then reconcile unknown submissions before retrying.`
  );
  process.exitCode = 1;
}
