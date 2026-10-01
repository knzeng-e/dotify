# Native contributions

## Product contract

A gift supports an artist profile. A tip identifies a work, independently of
its access mode. Neither grants access or changes an existing purchase. The
profile gift scope is the zero content hash; a tip uses the registered hash.
Free releases now use the same beneficiary editor as other works. Previously
published splits are immutable and are not silently reconstructed from credits.

The artist can set a purpose, recipient allocations, campaign reference and
start/end times. Times entered in the console are local; contract comparisons
and receipts use Unix seconds. End is exclusive. Outside the interval, the
artist receives their portion without host sharing or campaign attribution.

For a 10-token room tip with a 20% host share, the host receives 2 first. The
remaining 8 follows the work's 70/30 rights split: 5.6 to the artist portion
and 2.4 to the collaborator. Artist-chosen destinations divide only the 5.6.
Unassigned value and rounding dust return to the artist. A host can tip; no reputation or matching subsidy is
earned by doing so. At most 16 additional destinations can be configured.

## Runtime authority and settlement

`MusicContributionsPallet` is inherited by `MusicRoyaltiesPallet` so the existing
owner-confirmed royalties upgrade path can install its six new selectors.
`LibMusicContributions` owns a new namespaced slot. No existing storage changes.
Profile settings belong to the runtime owner. Work settings belong to the
original registrant, preserving the distinction from NFT and runtime ownership.
The profile gift UI refuses a runtime whose owner no longer matches its named
release artist. Future artist-directory/profile succession needs its own design.

Quotes bind chain, runtime, contribution intent, amount, host/room, allocation,
campaign, active interval and policy version. The transaction recomputes the
quote and rejects a changed digest. Each sender/intent can settle only once in
that runtime. Separate intents allow deliberate repeat tips. A 10-minute client
quote expires; the contract also refuses expiries more than 30 minutes ahead.

Each recipient receives a gas-bounded native transfer. Failure leaves a balance
under contribution ID plus recipient. Only that recipient can claim. A claim
that fails reverts and keeps the balance. Claims and contributions use the same
cross-pallet reentrancy guard as access payments. A contribution receipt records
the sender, work, host, room reference, campaign, quote digest, gross amount and
block timestamp; share events distinguish actual receipt from pending funds.

## Room trust

The signaling server verifies the host's existing Dotify session against the
API's bearer-authenticated `/api/auth/identity`. Existing signed-in sessions are
reused without prompts. Otherwise **Receive room tips** offers the normal
Dotify sign-in. Guests do not authenticate to listen. Tokens are never broadcast
or logged. A random room instance reference survives a host reconnect but not
room recreation, and avoids publishing the room's join code on-chain.

An explicitly configured server attestor signs a proof bound to chain, runtime,
work, payer, amount, intent, host, room and expiry. The artist must authorize that
attestor address in their runtime (profile default or work override). The
attestor has no funds and cannot submit a payer's transaction. It is a trusted
room attribution authority, not decentralized proof of audible listening.
Compromise could misattribute host allocations; artists can revoke/rotate the
authority. Do not describe connected accounts as verified unique humans.

Notifications check a successful finalized receipt from a registered artist
runtime, canonical block and matching room reference. IDs are deduplicated and
notifications are rate/room bounded. Receipt lookup, not a client chat message
or Celerity statement, establishes payment. Room chat remains ephemeral;
financial receipts survive on-chain. The known artist runtime remains a trust
boundary: owners can upgrade their own code. Reputation must not treat arbitrary
owner-emitted events as audited payment evidence without code attestation.

## Reads and recovery

Artist Earnings separates existing access royalties from Gifts & tips. It
shows gross contributions, account receipts, pending claims, per-work tips and
campaign-linked gross amounts. Campaign totals include collaborators/hosts;
they are not amounts received by a cause. You exposes the connected account's
sent/received contributions and host receipts. JSON export includes references.

The Earnings view starts with a combined overview: total generated, received
by the connected account, and available to claim. A compact source table
separates listening payments, gifts and tips. Listening-payment detail is the
default; Gifts & tips is a second keyboard-accessible detail tab. The combined
overview stays above both, with one contribution reader shared by the summary
and receipt list. Unknown sources suppress the corresponding combined total;
stale sources keep their last snapshot and an explicit delayed status. Each
source retains its own read timestamp; the overview displays the oldest of
those timestamps, not a claim of a simultaneous on-chain snapshot.

Gross contributions belong to this artist runtime. Account receipts can also
include shares or host tips from other known runtimes. Sent contributions and
destinations assigned to causes are never added to the artist's settled income.

The reader scans known catalogue runtimes to a finalized block every 15 seconds
while visible. A failed read retains the last complete snapshot with a delayed
status; unavailable data is not shown as zero. This is bounded-catalog polling,
not an exhaustive indexer or an instant-finality claim. Runtimes absent from the
catalogue require future directory/indexer discovery to appear automatically.

The localStorage journal is scoped by chain, payer, runtime and work. It records
intent ID, amount and hash only, before invoking the wallet. Unknown submissions
are recovered from their finalized intent event, never resubmitted. Product
may return a native extrinsic hash; recovery can locate the corresponding EVM
event by intent ID. Existing unresolved direct-gift journals block new payments
until their wallet activity is reconciled. Browser storage is origin-specific;
without Web Locks, do not initiate contributions concurrently from multiple tabs.

Product writes use the existing CDM adapter and native-unit conversion. Public
EVM RPC reads must match the configured chain. Physical Product signing and
receipt mapping remain release evidence, not something local mocks establish.

## Campaign and reputation boundary

Campaign references are optional bytes32 identifiers shared by agreement. A
reference does not prove an organizer approved a participant or that a named
organization controls a destination. UI purpose text is an artist declaration.
No cause verification badge, impact claim, ranking or ambassador identity is
fabricated. Later work should add campaign membership, recipient identity
evidence and abuse-resistant recognition before financial leaderboards.
