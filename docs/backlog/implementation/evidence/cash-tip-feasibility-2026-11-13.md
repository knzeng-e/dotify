# CASH work-tip reassessment — 2026-11-13

Base: tested merged dev `0bb52754b14bc366690ac85d1d7ad1dc089d8d28`.
Implementation tested at `0fc08f09` (full identity in Git history); the following
evidence-only update changes no test or implementation source.
Branch: `research/cash-tip-host-feasibility`. Refs #406, #85 and #229;
#408 remains separate. This is offline research, not an SDK migration or a
payment/service deployment.

The [decision](../../../design/product-cash-tip-decision-2026-11-13.md) is no-go for
enabling the work-tip rail. Pinned Host SDK 0.28.0/TrUAPI 0.25.0 lack a caller id;
published TrUAPI 0.26.0 adds one and a partial outcome. Published Host SDK 0.33.0
exposes a newer request-object API, with a ^0.29.0 protocol dependency. The owner
has not accepted payment behavior on a matched distribution. Artist-policy
split/Room settlement and exact payment-unit provenance remain unverified.

## Primary source identities

- [SDK payment implementation](https://github.com/paritytech/product-sdk/blob/f14ff5e2ebf5f5cb7d237a11a9c4371db466e80f/product-sdk/packages/host/src/payments.ts): caller-generated ids and retained status contract. Current documentation is a discovery aid, not a shipped-Host proof.
- [Payment RFC-0006](https://github.com/paritytech/trinity-user-agents/blob/12ff192f2ca5b1fd060a866ba20b775154e146c0/docs/rfcs/0006-payments.md): per-product id, consent, status and fixed-asset units.
- [CoinPayment RFC-0017](https://github.com/paritytech/trinity-user-agents/blob/12ff192f2ca5b1fd060a866ba20b775154e146c0/docs/rfcs/0017-coinage-payment.md): separate V1 cents denomination, partial clearing and references.
- [Runtime payment capability](https://github.com/paritytech/trinity-user-agents/blob/12ff192f2ca5b1fd060a866ba20b775154e146c0/rust/crates/truapi/src/runtime/capabilities/payment.rs): payment requires a platform implementation; CoinPayment returns Unsupported in this snapshot. No inference that this commit is installed on the owner's phone.
- [Published TrUAPI 0.26.0 metadata](https://registry.npmjs.org/@parity/truapi/0.26.0) and [Host SDK 0.33.0 metadata](https://registry.npmjs.org/@parity/product-sdk-host/0.33.0): downloaded in memory, SHA-512 integrity verified, package/declaration files inspected without installation/execution. Digests are in [source identities](cash-tip-source-identities-2026-11-13.json).

Installed declaration digests and the no-go reasons are in the [pinned report](cash-tip-pinned-report-2026-11-13.json), reproducible with the offline command. The current
payment method forwards positional amount/destination/purse and returns the
Host-assigned id afterwards. No caller-stable status reference is exposed before
that response. The newer typed declaration is an external contract candidate;
SDK method shape and wire request fields both need to agree.

## Validation and limits

All 11 focused Node tests pass. They cover the actual pinned declaration surface and synthetic
fault scenarios: legacy lost-id counterexample, persisted caller-id recovery,
AlreadyExists, storage failure before request, changed payer/payee/work/runtime/
network/units/amount, missing/partial/failed outcomes and CoinPayment clearing
that never becomes verified contribution or access. A mixed newer wire/older SDK
and an optional id remain insufficient. The mock's durable server map is an
explicit assumption, not evidence of Host persistence.

Formatting and focused ESLint pass; 217 local links/anchors, offline backlog and
whitespace checks pass.

Run `npm --prefix web run test:cash-tip-feasibility` and
`npm --prefix web run research:cash-tips`. The CI Web gate runs the focused tests.
Application dependencies, lockfile, runtime ports and user payment UI are
unchanged. No Host API, wallet, balance query, payment, contract, service or live
quote was invoked. Versioned local inspection and public source reads were the
only external research activity.

Remaining: reviewed compatible SDK/Host selection; actual non-spending capability
and unit inspection; restart/lock/background status evidence; work-policy split
and receipt reconciliation. No funded trial or direct gift is activated. Keep
#406 open for those decisions; #408 cannot grant access from a callback.
