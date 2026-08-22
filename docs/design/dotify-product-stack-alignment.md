# Dotify On The Product Stack: Assessment And Proposed Architecture

Status: proposal. No code changes implied by this document alone.

Sources: [Product docs](https://docs.polkadotcommunity.foundation/),
[Product SDK](https://paritytech.github.io/product-sdk/),
[resources](https://docs.polkadotcommunity.foundation/reference/resources/),
[Polkadot Community Foundation](https://github.com/Polkadot-Community-Foundation).
Claims below are quoted or cited; where the documentation is silent, this
document says so rather than guessing.

## 1. What The Official Stack Actually Is

Ten architecture layers, each with a defined owner:

| Layer                 | What it provides                                                       | Where it lives                                                       |
| --------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Client tier           | The Polkadot app; apps run _inside_ a host container                   | Desktop / Mobile / `dev-dot.li`                                      |
| Identity              | Device attestation -> JWT, Lite usernames, Full personhood             | `identity-backend` (centralized HTTP), `people-lite`, `proof-of-ink` |
| Naming                | `.dot` names; usernames mirror into DotNS                              | DotNS                                                                |
| App delivery          | build -> Bulletin -> DotNS bind -> Browse listing                      | Bulletin + DotNS                                                     |
| Storage               | Content-addressed CIDs; authorization is a byte/tx quota with expiry   | Bulletin (para 1010)                                                 |
| Contracts             | PolkaVM via `pallet-revive`; CDM builds, deploys, registers, resolves  | Asset Hub (1000)                                                     |
| Identity in contracts | **Personhood precompile** returning a per-app privacy-preserving alias | Asset Hub                                                            |
| Money                 | CASH (pUSD asset 1) spent through Coinage; PAS pays fees               | People chain (1004)                                                  |
| Messaging & calls     | Encrypted chat, 1:1 voice/video; **signaling travels on-chain**        | People statement store + platform TURN                               |
| Discovery             | Browse                                                                 | `browse.dev-dot.li`                                                  |

Three properties matter more than the inventory.

**The host is the runtime.** `createApp` "requires a host and will throw on boot
without one". The chain client has no direct-WebSocket fallback. An app on this
stack is not a website that talks to chains; it is a guest process inside the
Polkadot app.

**Writing is gated by personhood.** Statement Store is a custom RPC on People
chain nodes, 512 bytes per statement, 1 KiB per account, ~48h retention, and an
account "MUST have a Statement Store allowance to write - granted via
Individuality runtime registration". Publishing is a privilege attached to an
attested person.

**The stack keeps its own centralized pieces.** `identity-backend` is "a
centralized HTTP service handling device attestation, username allocation, and
JWT sessions". Calls get "temporary TURN credentials" from platform
infrastructure. This is not hypocrisy; it is an honest admission that some roles
have no decentralized implementation yet. Dotify is entitled to the same honesty.

## 2. Where Dotify Already Aligns

More than the roadmap assumed.

**Contracts are already in the right execution environment.** Dotify's Solidity
contracts are deployed through Asset Hub's `eth-rpc`, which is a compatibility
layer over `pallet-revive` - the exact pallet the stack specifies. Dotify is not
on a neighbouring chain; it is on the same VM, reached through a different
toolchain. Verified: identical ArtistDirectory bytecode from both the DevNet and
Hub TestNet endpoints.

**App delivery is on-stack.** Bulletin chunked upload, DotNS binding to
`dotify-test01.dot`, `dev-dot.li` gateway. Delivered.

**Identity is on-stack.** App-scoped Product account, SS58 plus derived H160,
connected only on explicit user action.

**Content addressing matches.** Dotify already treats audio as immutable CIDs.
Bulletin is the same idea with a different authorizer.

**Encryption already assumes ungated reads.** Bulletin "reading never needs"
authorization - it gates storing, not retrieval. Dotify's DAV2 encryption is
therefore not redundant with a move to Bulletin; it is the _precondition_ for
one. Protected audio on a public content-addressed store must be encrypted, and
Dotify already does that.

## 3. Where Dotify Diverges

| Concern             | Dotify today                                 | Stack model                             | Real gap?                               |
| ------------------- | -------------------------------------------- | --------------------------------------- | --------------------------------------- |
| Contract toolchain  | Solidity, Hardhat, viem, hand-built manifest | PolkaVM, CDM, `@org/name` resolution    | Yes - composability and discoverability |
| Personhood          | Dev-operated registrar, unused               | Personhood precompile, contextual alias | Yes - and the stack's answer is better  |
| Payments            | `payForAccess` in native token               | CASH via Coinage, host payment APIs     | Yes - wrong asset, wrong surface        |
| Catalog metadata    | Fly read model over EVM logs                 | Bulletin CIDs + CDM resolution          | Partly - a cache is legitimate          |
| Audio storage       | Pinata / IPFS pinning                        | Bulletin                                | Contested - see §6                      |
| Room signaling      | Socket.IO on Fly                             | People statement store                  | **Blocked** - see §4                    |
| Content-key custody | Fly, `CONTENT_KEY_MASTER_SECRET`             | No equivalent                           | **No stack answer exists**              |

## 4. The Constraint That Shapes Everything

Dotify's first product invariant:

> A room guest can join from a link without a wallet, signature, or payment.

The stack's messaging model is the opposite by construction:

- statements require an allowance, granted by Individuality registration;
- official calls are **1:1**, and "voice and video calls are a mobile-only
  feature today";
- signaling rides the People statement store, 512 B per statement, 1 KiB per
  account.

A WebRTC offer is roughly 1.5-4 KB. That is 3-8x the per-statement ceiling, and
the per-account ceiling is 1 KiB - so a peer cannot hold even one SDP in the
store. Chunking does not rescue it; the budget is the wall, not the chunk size.

And the arithmetic is the _lesser_ problem. The greater one is that a guest must
publish an answer to complete a handshake, which requires an attested identity.

**Moving Dotify's rooms onto the official messaging layer would convert every
listener into a registered, attested person.** That does not degrade the
product; it deletes it. The gesture Dotify exists to protect - "someone lets
another person listen with them" - becomes an onboarding funnel.

This is where the word _convivial_ earns its keep. A convivial tool, in Illich's
sense, is one people can use without first submitting to an institution. A
listening room that demands attestation at the door is a well-engineered
enclosure. The north star is explicit that Web3 here is "invisible trust", not
decoration - and an identity checkpoint is the most visible decoration there is.

So: **the anonymous guest is not a legacy compromise to be migrated away. It is
the design constraint the architecture must be built around.**

2026-08-06 host evidence adds a second, lower-level constraint: the current iOS
Product container does not expose `window.RTCPeerConnection` to Product
scripts. That prevents in-container Dotify room audio before ICE or TURN can
start. The current fallback opens the canonical HTTPS room in the browser; true
in-app mobile rooms require a Product Mobile host capability, tracked in
[dotli-community#27](https://github.com/Polkadot-Community-Foundation/dotli-community/issues/27).

## 5. Proposed Architecture: Three Rings

Organise every component by how much trust it requires, and shrink the inner
rings rather than pretending they are empty.

```text
Ring 1  On-stack, no compromise
        contracts (CDM) · personhood (precompile) · payments (CASH)
        app delivery (Bulletin/DotNS/Browse) · catalog metadata (Bulletin)
        room discovery + presence (statement store)

Ring 2  Minimal necessary infrastructure
        stateless SDP rendezvous · TURN relay

Ring 3  The stated exception
        content-key custody
```

The rule: a component may only sit in an outer ring if no inner-ring mechanism
can hold it, and the reason is written down.

### Ring 1 - move these, they are strictly better on-stack

**Contracts into CDM.** Register the runtime family as `@dotify/*`. The
generated manifest already exists; CDM registration adds name-based resolution,
Bulletin-hosted ABIs, and composability - another product can resolve
`@dotify/artist-runtime` and read a catalog without asking Dotify. First-writer
-owns makes the name a durable asset. Solidity stays; the target is already
PolkaVM.

**Personhood onto the precompile.** Replace the dev registrar. The runtime's
`requiredPersonhood` reads the precompile directly, receiving "a
per-application, privacy-preserving pseudonym: the same person yields a
different alias in a different context". This is the single strongest alignment
available: Dotify's `human-free` access mode becomes real, private, and
unlinkable across apps, and the registrar disappears. It also retires the
project's weakest claim.

**Payments to CASH.** Users see CASH as their balance; PAS is a fee token they
should not think about. Charging in PAS is a category error on this stack. The
runtime stays the authority on entitlement; settlement moves to host payment
APIs.

_Open problem, stated plainly:_ CASH lives on People chain, the runtime lives on
Asset Hub. Cross-chain settlement is unsolved here. Two candidate shapes - a
host-signed payment receipt the runtime verifies, or an Asset-Hub-side
entitlement credited from an attested People-chain transfer. Both need design
work. Do not ship a payment path until this is settled.

Interim implementation note: Classic unlock now goes through Dotify's
`RuntimeWritePort`, so a build can switch from viem to Product CDM contract
handles without changing the listener UI. That is still native-value runtime
payment, not Product-native CASH settlement.

**Catalog metadata to Bulletin.** Release metadata, artwork, and manifests are
small, immutable, and public. Exactly Bulletin's shape. The Fly read model
becomes a cache with a provable source, not the source.

**Room discovery and presence to the statement store.** A `{room, host,
listeners, ts}` record is ~100 B, well inside 512 B, and `ChannelStore`'s
last-write-wins is the right primitive. The _host_ is identified and can hold an
allowance, so this works without touching the guest. Rooms become discoverable
without Dotify's servers - a genuine decentralization win that costs the product
nothing.

### Ring 2 - shrink, do not eliminate

The current signaling service does rooms state, presence, chat, reactions,
requests, and SDP relay. Most of that moves to Ring 1. What is left:

**A stateless SDP rendezvous.** No room registry, no chat, no persistence -
short-TTL mailboxes keyed by room code, so an anonymous guest can hand its
answer to a host. This is the irreducible remainder of "let a stranger connect
without an account".

**TURN**, for peers behind symmetric NAT.

The stack does the same thing for its own calls: platform-issued TURN
credentials, because NAT traversal has no on-chain answer. Ring 2 is not
Dotify's deviation from the stack; it is the same concession the stack makes,
kept as small as the product allows.

TURN only helps after a browser or host-provided peer connection exists. It
cannot compensate for the current Product Mobile sandbox removing
`RTCPeerConnection`; that requires a host API or permission change, not a relay
configuration change.

_Open question worth asking the Foundation:_ can third-party products obtain
TURN credentials from platform infrastructure? If yes, Ring 2 halves.

### Ring 3 - name the exception

Content-key custody cannot move. Protected audio must be encrypted at rest on a
publicly readable store, the key must be released only after a server-side
access check, and the stack offers no confidential compute to run that check.
Putting the key in the client defeats the encryption; putting it on-chain
publishes it.

The honest position is to say so, and to reduce the blast radius rather than
claim it away:

- **Per-artist custody** - an artist's runtime designates its keyholder, so
  Dotify is not one master secret for the whole commons. This follows directly
  from artist sovereignty: an artist who controls catalog, access, and rights
  should control the key too.
- **Threshold shares**, so no single operator can unilaterally release.
- **Narrow the window** - keys scoped per track, per session, short-lived.

Ranked by fit with the north star, per-artist custody is the strongest: it turns
the platform's most centralized component into an expression of the project's
central political claim.

## 6. What I Would Not Do

**Do not move audio to Bulletin yet.** Bulletin authorization is "a bounded
quota with an expiry, not a permanent grant", and the docs give no size limits
or retention guarantee for MB-scale media. A growing catalog would need
perpetual re-authorization, and an expired quota on a music library is a dead
catalog. Move metadata now; move audio when quota economics for large media and
indefinite retention are demonstrated. Revisit, do not assume.

**Do not adopt the official calls layer.** 1:1 and mobile-only cannot serve one
host with many listeners.

**Do not rewrite the contracts to ink!.** They already run on the target VM.
Rewriting spends the project's scarcest resource on zero user-visible gain.

**Do not delete the Fly API to look decentralized.** It would move key custody
into the browser - strictly worse for artists and listeners, and dishonest about
where trust sits. The stack runs a centralized identity backend for the same
class of reason.

## 7. Sequence

Ordered by value per unit of risk:

1. **Personhood precompile** - retires the weakest claim, unlocks `human-free`,
   no user-facing regression. Highest value, self-contained.
2. **CDM registration of `@dotify/*`** - claims the names, makes the catalog
   composable. Manifest work already done.
3. **Presence and discovery to the statement store** - real decentralization,
   guest path untouched.
4. **Catalog metadata to Bulletin** - Fly read model demoted to cache.
5. **Shrink signaling to a rendezvous** - only after 3 lands.
6. **Per-artist key custody** - the deepest change; do it when the runtime work
   above has settled.
7. **CASH settlement** - after the write-port seam and host transaction evidence,
   and only after the cross-chain design is proven.

Steps 1-4 are additive and independently shippable. Nothing before step 5
touches the walletless guest path.

## 8. Honest Summary

Dotify is closer to the official stack than the roadmap assumed - same VM, same
delivery path, same content addressing, and an encryption model that Bulletin
would require anyway. The genuine gaps are personhood, contract registration,
payments, and metadata storage, and all four are improvements Dotify should
want.

One gap will not close: the stack's messaging assumes attested participants, and
Dotify's rooms assume strangers. That is not a defect on either side. It is two
products with different social contracts. Dotify should adopt the stack
everywhere it fits, and keep the smallest possible amount of infrastructure to
protect the one promise the stack cannot make - that you can send someone a
link, and they can just listen.

Build infrastructure for relation, not a casino wearing headphones, and not a
turnstile either.
