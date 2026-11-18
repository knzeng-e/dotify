# A09 finalized-key authority validation — 18 November 2026

Frozen source: `24d863b3468648c1523a2f449f307d738788be51`, based on merged
`dev` `6ca1f50c2dd6de1c4fc2643951a5f8258ea6e485` (#487).
[Issue #488](https://github.com/knzeng-e/dotify/issues/488) /
[PR #489](https://github.com/knzeng-e/dotify/pull/489).
This is source validation, without deployment or new chain transactions.

## Environment and results

macOS arm64, Node 22.23.5. API dependencies match the lockfile; Web dependencies
were freshly installed with `npm ci`. Locked Web Product SDK is 0.39.0 and
`product-sdk-tx` is 0.5.3. No dependency/lockfile change is part of A09.

| Frozen-source check | Result |
| --- | --- |
| Complete API suite, `--test-concurrency=2` | 687 pass, 44 suites, no skips; 255.122 s |
| Targeted chain authorization, A01 isolation and key routes | 74 pass, no skips |
| API typecheck and build | Pass |
| Complete Web unit suite, `--maxWorkers=4` | 1,248 pass, 162 files; 20.57 s |
| Web build | Pass; existing bundle chunk-size warning remains |
| Web lint | No errors; two existing dependency-array warnings in `App.tsx` |
| Changed TypeScript formatting, backlog offline, whitespace and introduced local links/anchors | Pass |

API command: run the existing `npm test` file list with Node's
`--test-concurrency=2`; the file list is unchanged. Frontend commands:
`npm run test:unit -- --maxWorkers=4`, `npm run build`, `npm run lint`.
No test was excluded or weakened to pass these checks.

The initially reused local Web installation was SDK 0.27 / transaction package
0.4.7 despite the different lockfile. It produced three signer-related unit
failures and corresponding type errors. Reinstalling the exact lockfile in this
isolated worktree resolves them; the earlier results are not evidence of an
A09 source regression or a dependency upgrade. The full locked run above is
the accepted local result.

## What the tests establish

The real Viem HTTP fixture observes only finalized/latest block tags and
EIP-1898 canonical hash reads. An entitlement available only at latest denies;
a newer finalized observation permits the same request. Unsupported finalized
state denies a previously warm allow without another access read or fallback.
The fixture is not a live provider/finality proof.

Deterministic authority fixtures cover a reorganized-away purchase, newer
current-state deactivation, changes in either cached block identity, malformed
or inconsistent headers, failures of either canonical-state proof, a catalogue
source block beyond finality, same-block proof reuse, Room-host/Free checks,
coalesced expiry and an overlong two-state proof. Existing canonical identity,
policy, TTL, account/session, source-format and retained-key tests also pass.

Route tests count zero derivations for pending finality through signed and
session requests for individual/Room-host purposes, anonymous Free requests and
queue preparation. The denial carries no key or unlock action. The Web maps it
to existing retry behavior and explicitly says no new payment is needed.

## Remaining acceptance

Hosted CI is still a separate gate on the final PR head. No configured live
primary/fallback endpoint has been accepted here for truthful finalized-tag
semantics, EIP-1898 historical state, quotas or latency. No physical Host,
new payment, deployment, RPC switch, contract generation or active-state reset
was performed. Follow the [policy and deployment gate](../../../reference/finalized-key-authority.md)
before matching delivery. Existing disclosed/prepared keys and streams cannot
be recalled. Other audit findings retain their separate scopes before the
owner-selected fresh testnet generation.
