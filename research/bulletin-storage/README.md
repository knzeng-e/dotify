# Bulletin media feasibility

This is a read-only inventory, not a storage adapter or production setting.
See the [research note](../../docs/research/bulletin-media-storage-2026-10-29.md)
for the current findings, options and acceptance gates.

From the repository root, using Node 22 and dependencies installed from the
existing web lockfile:

```sh
npm --prefix web ci
node research/bulletin-storage/inspect.mjs
```

The script connects only to Dotify's current public Bulletin RPC. It verifies
genesis, reads finalized metadata/state, prints scalar limits and renewal call
names, and disconnects after at most 45 seconds. It never loads a signer or
submits transactions. Its Polkadot API imports resolve from `web/package.json`;
there is no separate package install or new dependency.

Byte/transaction limits are quotas and runtime bounds, not throughput or price
benchmarks. A recent 100-block timestamp interval is an observation, not a
guaranteed block time. The renewed-byte counter is a runtime capacity indicator,
not a measurement of disk space, free capacity or an entitlement for Dotify.
