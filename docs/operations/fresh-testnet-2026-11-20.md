# Fresh audited core — 20 November 2026

The NFT-free core is **deployed, finalized and explorer-verified** on chain
420420417 from merged `dev` `146fb446765ea796d3bbbd7b42a36bd93d105a3c`
(#501; the same contract artifacts as the tested preparation). This is the core
checkpoint for [#317](../backlog/fresh-testnet-streaming-cutover.md), not an
activated API/client generation or native-payment/device acceptance.
The later [21 November checkpoint](fresh-cdm-2026-11-21.md) records Bulletin
metadata, exact CDM version 4 and stopped-publisher maintenance. Statements below
about the earlier active CDM describe this 20 November checkpoint.

The [structured public record](fresh-testnet-2026-11-20.json) contains all eleven
transaction hashes, successful receipts, addresses, gas observations and the
finalized readback. No private configuration, session records or signer material
is included. The [preparation procedure](../how-to/prepare-fresh-testnet-generation.md)
owns the reusable deployment and cutover steps.

## Observed core

| Check | Result |
| --- | --- |
| Deployer | `0xc3571714248588c6e19cdece2778b75341b2c288` |
| Directory | `0x8af1531278831fe92689558f7b6cae92fc682ca4` |
| Factory | `0xe2199c16ea32402dd2bdc3730afba49ad5cd83f5` |
| Initializer | `0x2532718ccaa3720e01e68c5783ba86bb6620ee36` |
| Finalized readback | Block `16001109`, hash `0x3ac009543073e18e1aa5e865ec29971e3c56d58687654512f2e56e10fe4a246d` |
| Finalized artist count | `0` |
| Native Balance precision | `10` decimals |
| Core transactions | 10 creations and one directory `setFactory`, nonces 485–495 |
| Observed account debit | 8.101176 TEST-PAS; all calls have zero transferred value |
| Per-call bounds | Gas limit 2,000,000; legacy gas price 1,000,000,000,000 wei |

All ten bytecodes match compiler output at the named finalized block, masking
only compiler-declared immutable slots. Independent getters bind those slots to
the new directory, initializer, seven implementations and native precision.
The directory's deployer/factory bindings match. Contributions are installed
through royalties; no NFT implementation is deployed. All ten sources are
[verified on Blockscout](https://blockscout-testnet.polkadot.io/address/0xe2199c16ea32402dd2bdc3730afba49ad5cd83f5#code).
This does not create an artist or exercise the eight-approval native bootstrap.

## Execution reconciliation

The initial operator wrapper did not intercept the already-created viem
transport. Execution was interrupted before wiring. All ten creations were then
independently recovered from chain receipts, exact transaction inputs, source
artifacts and consecutive nonces. Their actual transactions retained the
configured gas and price bounds. No creation was repeated.

The remaining wiring used a newly constructed guarded transport, verified in a
no-broadcast fixture, with exactly one permitted target/calldata/nonce. Its
unsigned intent and returned hash were durably recorded before receipt
verification. The final independent readback and source verification passed.
Private execution/reconciliation journals are retained. A partial journal must
be reconciled before another operation; it is not permission to replay a call.

## Active state is still the earlier generation

No CDM update, Bulletin metadata/application write, service restart/configuration,
database mutation, secret rotation, artist creation, music publication or payment
was performed by this checkpoint. The existing CDM snapshot, root deployment
configuration and Web bindings remain the earlier matching set until coordinated
delivery. Do not copy the new addresses into only one deployed component.

Read-only inspection confirms that hosted PostgreSQL namespace `dotify` still
binds the old directory and its runtime role's row policies admit only that
namespace. A different directory cannot reuse it unchanged. The existing
operator `fly-user` connection resolves to `schema_admin`; this inspection ran
inside a rolled-back read-only transaction. No role was created or broadened.

The owner-selected next step accepts a development maintenance interruption:
create the artist runtime with its wallet, configure its Bulletin publisher,
then start the matched services and clients. The existing publisher preflight
remains mandatory. The [configuration reference](deployment-configuration.md#testnet-cutover-with-an-interruption)
defines activation and preservation boundaries.

Remaining delivery is exact CDM metadata retention/versions, a separate
generation-specific API namespace and receipt/catalog paths, matched signaling,
authoritative new-generation bootstrap and an identified Web/Product release.
Existing session revocations, replay protection, quota usage, content secrets, account
nonces and retention obligations must survive the quiesced cutover. After
ordinary artist creation, bind a new unused content-key domain and reviewed
Bulletin profile to that actual runtime. Native payouts and physical Runtime
0.31 signing/listening remain separate acceptance gates under #484/#85; #317
stays open and CASH stays disabled.

## Validation boundary

The deployed source's
[merged-dev quality run](https://github.com/knzeng-e/dotify/actions/runs/44770089188)
passes at `146fb446`. The public receipt manifest is retained unchanged; its
successful unique transactions, consecutive nonces and receipt-fee sum can be
checked independently against the observed account debit. This documentation
change leaves API code, tests and configuration identical to that merged source.
API build/typecheck and the 14 existing startup/configuration checks pass after
that comparison. Local documentation links/anchors and public receipt invariants
are checked separately. New-PR checks do not establish a hosted namespace/policy change, application
delivery or physical-device acceptance.
