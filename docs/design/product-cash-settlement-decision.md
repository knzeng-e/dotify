# Product CASH Settlement Decision

Status: W16 decision record.  
Date: 2026-09-14.  
Decision: Product CASH access payments remain unavailable in Dotify until Product
exposes an authoritative settlement or attestation path that can grant and
verify Asset Hub runtime entitlement.

This review was performed against the current published SDK versions:
`@parity/product-sdk@0.27.0` and `@parity/product-sdk-host@0.19.1`.

## Official Sources Rechecked

- Product DevNet update, 2026-09-09:
  https://forum.polkadot.network/t/polkadot-product-devnet-update/18602
- Product money model:
  https://docs.polkadotcommunity.foundation/architecture/money/
- Product addresses and registries:
  https://docs.polkadotcommunity.foundation/reference/addresses/
- Product SDK Host API:
  https://paritytech.github.io/product-sdk/api/host/
- Product SDK transaction API:
  https://paritytech.github.io/product-sdk/api/tx/

## Current Facts

Product DevNet is a Paseo system-parachain suite:

| Component | Current W16 fact |
| --- | --- |
| Product app | `dotify-test01.dot` |
| Contracts and DotNS | Asset Hub para `1000` |
| Identity and CASH | People para `1004` |
| App bundle storage | Bulletin para `1010` |
| Asset Hub EVM chain id | `420420417` |
| CASH on People | local pUSD asset id `1` |
| CASH on Asset Hub | protected asset id `50000413`, 6 decimals |
| Current CDM registry | `0x05662b3dbd5dd9f2ff92d67630477e84b0b37c1f` |

The September 2026 Product DevNet reset moved DotNS/CDM registries and required
fresh descriptors. That matters for any payment proof because stale registry or
descriptor evidence can decode the wrong chain state without throwing a useful
Dotify-level error.

The Product Host payment surface is intentionally high-level. `PaymentManager`
exposes balance subscription, top-up, `requestPayment(amount, destination,
from?)`, and payment-status subscription. The documented terminal status is
`Completed` or `Failed`. `requestPayment` returns an opaque payment id, while
the status subscription does not expose a chain transaction hash, finalized
block, amount/recipient binding, or an Asset Hub entitlement proof. That is
enough to drive a Host-mediated payment experience, but it is not the same fact
as a Dotify runtime access grant.

Dotify's Classic entitlement is on the artist SmartRuntime. Today it is granted
by `musicRoyPayAccess(contentHash)` on Asset Hub and then read back through
`musicAccHasPaid(contentHash, listener)` plus
`musicAccCanAccess(contentHash, listener)`. The key service opens full playback
only after the runtime read-back confirms access.

## Options Considered

| Option | Trust assumption | Decision |
| --- | --- | --- |
| Treat Host `PaymentManager` `Completed` as access | Trusts an off-chain/high-level Host status without runtime entitlement | Rejected. A CASH receipt alone does not update `musicAccHasPaid` and cannot authorize key release. |
| Dotify-operated relay receives CASH and calls `musicRoyPayAccess` | Trusts Dotify custody, exchange/accounting, relay uptime, and replay controls | Rejected for W16. This is a trusted payment processor, not Product-native settlement, and requires an explicit product decision. |
| Implicit CASH-to-PAS/native conversion | Trusts an exchange rate and asset bridge not present in Dotify | Rejected. W16 forbids implicit exchange rates and fake CASH settlement. |
| Product-confirmed CASH-to-runtime entitlement bridge or attestation | Product supplies a verifiable proof binding payment and runtime grant | Required future path. Not available in current official docs/API snapshot. |
| Keep native runtime payment for Classic and leave CASH disabled | No new payment trust; runtime remains entitlement authority | Accepted for W16. |

## Required Future Proof Shape

A future CASH path must prove all of these before Dotify can label access as
acquired:

- quote id and idempotency key;
- payer Product public key and derived H160 runtime address;
- recipient address;
- CASH amount in atomic 6-decimal units;
- People asset id `1`, Asset Hub protected asset id `50000413`, and Asset Hub
  EVM chain id `420420417`;
- exact runtime address and content hash;
- Host payment id and terminal status;
- People-chain finality, including a reorg-safe block identity;
- one Asset Hub runtime entitlement for the same payer/runtime/content hash;
- replay protection proving the same receipt was not reused;
- reconciliation result for crashes, timeouts, duplicate retries, and payments
  that settled without entitlement.

An implementation can pass W16's future "one real receipt creates exactly one
entitlement" requirement only when this proof is provided by a Product-supported
mechanism or an explicitly approved trust design. A private Dotify relay is not
allowed to pretend to be that mechanism.

## Implemented Boundary

The current repository keeps the rail closed in three places:

- `web/src/features/payments/paymentModel.ts` models `product-cash` as
  `status: 'unsupported'` with settlement
  `pending-product-confirmation`.
- `RuntimeWritePort.payForAccess` accepts only
  `ExecutableTrackAccessPaymentIntent`, which is currently the native runtime
  payment intent.
- `web/scripts/product-cash-settlement-readiness.mjs` validates this static
  boundary and can inspect future evidence. The CLI reports missing official
  support as `blocked`, rejects unsafe evidence as `fail`, and exits non-zero
  only for invalid/unsafe evidence.

Run:

```bash
cd web
npm run smoke:product-cash-settlement
```

Optional future evidence can be checked with:

```bash
cd web
npm run smoke:product-cash-settlement -- \
  --evidence /path/to/product-cash-evidence.json \
  --json-out /tmp/dotify-product-cash-settlement.json \
  --md-out /tmp/dotify-product-cash-settlement.md
```

The default result should remain `cash-settlement-unavailable` until Product
documents or ships the authoritative bridge/attestation path.

## Operational Consequence

Classic support stays on the native runtime payment rail for the current pilot.
Product CASH can be shown as planned/future work, but the UI and backend must
not claim a listener acquired access from CASH unless the SmartRuntime read-back
confirms the matching entitlement.
