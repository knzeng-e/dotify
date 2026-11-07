# Room preparation reliability delivered — 2026-11-07

**Web and Product 0.1.80 are published and independently verified** from frozen
source `30702580299b19f8a54d1a20b8e4bd44629142d9` on `release/product-0.1.80`, based on merged/tested dev
`e7614b4d6993ab16b57eeb4c65f73c6c29919690`. This delivers #404 and preserves the
#403 delivery history. Refs #395, #388 and W33/#288; the owner confirms one native Room start without retry and audible guests,
but approximately 55-second preparation and broader lifecycle remain open. [Structured public evidence](product-0.1.80-rollout-2026-11-07.json) contains exact
receipts, finalized readback and the scoped Host comparison.

[Exact-source CI](https://github.com/knzeng-e/dotify/actions/runs/42413354600) and
[merged-dev CI](https://github.com/knzeng-e/dotify/actions/runs/42406104441) pass.
The frozen release differs from dev only in appVersion `[0, 1, 80]`.

## Listener result and demonstrated boundary

The [implementation evidence](room-preparation-relay-2026-11-07.md) demonstrates
a mismatch: complete Room preparation has four useful object reads in flight,
while the existing API permits two distinct upstream downloads. The client now
queues its known API relay reads, including response bodies, so its own useful
prefetch work does not provoke busy replies and unnecessary gateway fallback.
The authenticated four-object producer, key checks, complete local Room source,
60-second startup budget and memory bounds remain. Native/Bulletin/direct
recovery and other clients' API capacity are not redefined.

This fixes a reproduced failure mode, not a measured root attribution of every
phone delay. The owner previously heard eventual Room sound after two or three
attempts and saw an audio-slow failure in solo after an attempted Room. Earlier
0.1.79 pause/reopen and Room-to-solo successes stay separate dated observations.

On failure, **Copy support report** exports bounded local startup/output phases
and build identity. Explicit copy sends no telemetry; the serializer excludes
URLs, CIDs, accounts, keys and arbitrary error text. A labelled selectable
textarea handles Hosts that deny clipboard. Retry remains explicit and guests
gain no content-key request. Browser tests exercise copied and denied-clipboard
reports plus audible retry after failed complete preparation.

## Exact application writes and retention

Completed **2026-11-07T21:40:42.597Z**: **13 stores / 4,425,117 bytes**,
**7 immediate one-off renewals / 5,061,961 bytes**,
**20 distinct CIDs / 9,487,078 accounted bytes**, and **two DotNS signing requests**.
Nonces span **1250–1269**.
Each CID consumes one operation; no uncertain submission is retried blindly.
The owner approved the exact new 0.1.80 cap separately from completed 0.1.79.

CAR: **9,450,224 bytes**, SHA-256 `e82c26401295f864f0e5587c766a4865b241eded0e770d429d53eeef57772458`, storage root
`bafybeicrvq7anzmj2zqjyhbaiix3fidmkzygg2vwcbt5pqfk4iuyxqigxy`. Offline verification authenticates 101 inner blocks, 71 files
and 20 outer objects. Before DotNS writes, every dependency has fresh canonical
retention and authenticated retrievable bytes. Independent finalized readback
checks all 20 positions/expiry values, reconstructs the CAR and compares identical
gateway bytes. Every renewal has strictly later canonical expiry. Finalized
owners/resolvers, root/app contenthash and appVersion `[0,1,80]` match; the lab
remains at 0.3.1.

Netlify entry `./assets/index-DYA1jrYX.js` is **1,149,566 bytes**, SHA-256 `01823d2e0e4314a428e74a5736f38d89a03a7118264c5ffbfb25c675ee4074af`,
matching the exact reconstructed build with its existing clean=false identity.
Public config digest `0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9` is unchanged. Fresh mobile-size
public boot has no wallet/key/playback request or uncaught error.

After publication: **611 available transactions**,
**339,786,831 store bytes**, **395,833,090
renewal bytes**. Preserve all prior **411 future renewals / 140,997,127 bytes**
and conservatively add the complete candidate graph: **431 future renewals /
150,484,205 bytes**. Immediate renewals do not erase that future floor. Earliest
candidate expiry is **1750574**; account authorization independently expires at
**1621405**. These reservations activate no scheduler or automatic renewal
and are not a complete historical-conservation or off-volume-recovery proof.

## Host versions: scoped compatibility, not a blanket SDK claim

The owner reports **iPhone app 0.10.0 (20), TrUAPI Runtime 0.26.0**, and confirms
account connection plus audible existing eight-second playback in deployed
0.1.79 on that build. The [official build-20 release](https://github.com/Polkadot-Community-Foundation/polkadot-ios-community/releases/tag/devnet/2026-11-06.2)
identifies source `55c308bf301d6a8695462741853b275dfa893054`; its Swift package lock
pins TrUAPI 0.26.0, revision `e7ce413f6e851439b8d82767aebcfe3c33f2ebe8`.
Installed Desktop Dev remains 0.1.4-rc.3 / protocol 0.25.0.

The initial global-schema mismatch caution was too broad for Dotify's used API.
Independent public npm package comparison covers eight used generated clients
(account, chain, signing, permissions, preimage, system, statements, local storage),
262 reachable type definitions and 88 existing wire addresses. Generated runtime
logic matches after removing comments; only existing remote/device permission
enums append BalanceAccess/Motion, leaving old discriminants unchanged. Nine
actual client-0.25 / peer-0.26 request/response round trips preserve account index
zero, synthetic raw signing/transaction construction, permission grant/denial,
Location denial, chain identity and navigation. New BalanceAccess fails closed
on the old decoder in a deliberate negative check.

The changed Host payment-purse API is excluded: Dotify's current native payment
path signs contracts through the unchanged signing/chain domains and does not
call Host PaymentManager. Schema hashes differ (`3c45e49b26c1ab97` versus
`5f68beddf80f7b9a`) despite codec 3. This is evidence for Dotify's existing used
surface, not general interchangeability, real transaction acceptance on build 20,
or support for protocol 0.29. No SDK pin, Host app or artifact was replaced.
SDK 0.39.0 / wrapper 0.28.0 / TrUAPI 0.25.0 remain. A full upgrade is a separate
coordinated migration with its own permission/payment/native acceptance.

## Operational and acceptance boundaries

Custody was idle immediately before signing; the exclusive account lease and
exact source/call/nonce/budget guards apply. Public identity was verified, the
phrase passed privately over FD3, launchctl was cleared immediately after
capture and again on exit, and absence was independently checked. No secret or
content key appears in the public record.

API/custody remain source `e2dd614862a8d9e3c5373689f58195b069130c07`; readiness,
both catalogue entries and three bounded public encrypted-media reads pass.
Signaling remains the previously verified 0.1.79 image; no service deployment,
restart, environment, CORS, scale, volume, policy or key change occurs. No musical
audio/cover/metadata, artist registration, purchase or domain renewal is sent.
The current 0.1.79 graph was also freshly authenticated/retrievable before this
operation. A rollback requires fresh retention verification and separately
bounded DotNS write authorization; preserve all receipts/nonces.

Local frozen builds, 25 configuration/Host/raw-wire checks, four operator
budget/renewal checks, exclusive lease and synthetic FD3 handoff pass. Both
source CIs pass all jobs, including core browser flows and three-engine audio.
Existing implementation tests reproduce the four-read/two-download mismatch and
verify body/cancellation ownership; native device timings are not simulated proof.

## Owner phone result — 2026-11-07

In the requested 0.1.80 test with existing **Adang Fobe**, the owner confirms
Room preparation completes **without retry in approximately 55 seconds**, and
answers yes to audible sound at the requested Web/Desktop guests. The current
reported phone is Polkadot app 0.10.0 (20), Runtime 0.26.0. This accepts the
reported successful start and guest delivery on this attempt, not comfortable
startup latency or every lifecycle path.

The delay remains too long for the intended shared-listening experience and
leaves little margin against the existing 60-second post-authorization startup
budget. The owner’s approximate wall-clock observation is not a phase trace:
it must not be subtracted from that budget as if both clocks had the same start.
No per-phase report, cache measurement or network restatement was supplied.
Do not label this a cold-cache result, attribute it to decryption/network/Host
without evidence, or claim the recent relay correction proves all failures fixed.

Keep #395 open for reducing startup latency and broader native lifecycle.
The next diagnosis should separate authorization, authenticated object retrieval,
local AAC assembly/media readiness and capture activation, while preserving
access checks and the existing deadline. Reusing an already prepared authorized
source, if applicable, needs evidence and source-lifetime invariants first;
raising the timeout would not make starting the Room faster. Full-song continuity,
new-build lock/unlock/recovery and #388/W33 access/conservation gates remain
separate. No new upload, purchase or service change was made for this feedback.
