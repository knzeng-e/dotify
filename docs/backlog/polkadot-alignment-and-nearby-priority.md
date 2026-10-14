# Product priorities after the Polkadot alignment audit

Planning issue: [#273](https://github.com/knzeng-e/dotify/issues/273).

Decision date: 2026-10-14. Owner-requested revision based on release 0.1.48
(`fc7faf5`) and the Product/JAM architecture audit. This document sets scope and
order; Project 5 owns live status. Planned capabilities are not delivery claims.

## Decision and execution order

Nearby shared listening is the next product expansion: find people voluntarily
opening a musical moment in a shared physical area, then join through a simple
room link. Stablecoin feasibility is deferred. No payment redesign is needed
for Nearby; existing native payments remain the executable rail.

| Order | Scope | Ticket / source | Boundary |
| --- | --- | --- | --- |
| Release work | Playback, joining, publishing and tips reliability | W13 / #158, #85, #87–#89, #269 | Fix observed failures and retain physical/pilot acceptance gates. |
| Next product implementation | Find nearby rooms and publish a room within a chosen approximate radius | [#274](https://github.com/knzeng-e/dotify/issues/274), W19; delivered W18 | P1 / Now. Flagged implementation may start before aggregate W13 acceptance. |
| Supporting compatibility | Product SDK/Host matrix and versioned network profile | #85 | Reuse adapters; not a prerequisite for browser/manual-area Nearby prototyping. |
| Following artist increment | Artist-selected modules, safe updates and admin inventory | [#275](https://github.com/knzeng-e/dotify/issues/275), [runtime features](artist-runtime-features.md) | P1 / Next, after the first reviewed Nearby slice; artist retains authority. |
| Following sovereignty increment | Per-artist recovery and alternative key operator | [#276](https://github.com/knzeng-e/dotify/issues/276), [key portability](artist-key-portability.md); W07 record | P1 / Next; do not reopen the completed synthetic-recovery scope. |
| Transport exploration | Celerity event-class equivalence | W27 / #214 | Observation stays optional; Socket.IO stays authoritative. Not a Nearby dependency. |
| Later | Concrete stablecoin/Coinage feasibility | #85, W16 decision | P2 / Later follow-up, activated only after owner priority review and new supported evidence. |
| Watch | JAM executable targets and migration guidance | This audit | No JAM rewrite or dedicated chain/service scheduled. |

Reliability release work can continue alongside W19. Optional 3D/activity,
ambassador mechanics and wider realtime migration do not precede Nearby.
Runtime and recovery work are follow-ups, not proximity prerequisites.

## Nearby amendment

W18 delivered a privacy contract and inert protocol in PR #155. W19 previously
waited for aggregate pilot acceptance and shipped last. The owner now selects
it as the next expansion; implementation dependencies become W09, W10 and W18.
W13 remains a release gate. Separate host and listener radius controls in km
are proposed at 2 / 5 / 10 / 25 km, with 5 km selected inside the control;
validate actual values against coarse-cell uncertainty before collection.

Exact coordinates stay device-side. Matching respects both approximate areas;
sparse results offer explicit widening rather than expanding past consent.
Nearby supports foreground location and manual area with ephemeral discovery
state. It does not scan non-participants or prove physical presence. Links
remain usable from elsewhere. See [W19](implementation/W19-nearby-rooms.md) and
[W18's amendment](../design/dotify-nearby-discovery-privacy.md).

## Architecture corrections carried forward

- Under #85, preserve `RuntimeReadPort` / `RuntimeWritePort` and EVM/Product
  adapters. Assess SDK-specific changes there; remove casts hiding migration
  failures when touching integration. Validate auth signatures and contract
  approvals on exact supported Hosts, not only mocks.
- Generate a shared versioned network/deployment profile for frontend/API/tools:
  genesis, chain ID, addresses/code hashes, descriptors and asset identities.
  Resets fail closed and require explicit migration and historical read-back.
- Runtime inventory distinguishes current owner, original registered artist,
  personhood and work rights. Artist admission and portable attestations have
  their own design; no mandatory new DID wallet or streaming-platform pedigree.
- Recovery exports separable artist keys, never a global master secret. Storage
  integrity, renewable availability and key availability are distinct concerns.
- Future money models bind asset/network and atomic units. Host success alone
  cannot establish entitlement or correct royalty allocation.

## Dated external evidence and uncertainty

[SDK 0.36](https://github.com/paritytech/product-sdk/releases/tag/%40parity/product-sdk%400.36.0),
published 2026-10-13, changes signing/PAPI/Host interfaces; this backlog update
changes no dependency. [Product networks](https://docs.polkadot.com/apps/concepts/networks/)
have environment-specific capabilities; DevNet evidence is not mainnet evidence.

[Native Polkadot USDC](https://www.circle.com/multi-chain-usdc/polkadot),
[planned Product pUSD/Coinage](https://docs.polkadot.com/reference/apps/hosts/polkadot-app/coinage/)
and [DevNet CASH](https://docs.polkadotcommunity.foundation/architecture/money/)
are distinct. Draft [Coinage RFC 0017](https://github.com/paritytech/trinity-user-agents/blob/main/docs/rfcs/0017-coinage-payment.md)
proposes clearing references; entitlement integration and shipped Host support
remain to verify. Revisit W16 when activated with new evidence; its completed
result is dated, not a permanent statement about future APIs.

[Parity's 2026-10-12 JAM update](https://www.parity.io/blog/jam-what-it-is-how-it-works)
describes ongoing engineering and a prototype Parachain Service. Retain portable
domain rules and versioned data; wait for concrete execution/migration guarantees.

Our Web3 acceptance measure is an exit test: can an artist move releases, keys
and existing policies to another compatible operator? This is our reading of
the [Web3 Foundation manifesto](https://web3.foundation/manifesto), not a
capability automatically supplied by Product or JAM.
