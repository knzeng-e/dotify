# Room realtime transport decisions

W27, activated and subsequently expanded to the full sequence by the owner on
2026-09-30 before the remaining W13 pilot evidence. This permits implementation,
not an accepted pilot or permission to change deployed transport authority.

## Guarantee matrix

This classification precedes Celerity routing. The inventory comes from
`web/server/signaling.mjs` and `docs/reference/socket-events.md`.

| Events | Required semantics | Decision for this slice |
| --- | --- | --- |
| `rooms:list`, `rooms:updated`, existing discovery beacons | Bounded disclosure, expiry, best effort discovery; room service decides joinability | Hybrid: existing opt-in beacons, Socket.IO canonical |
| `presence:solo`, `presence:solo:updated` | Anonymous aggregate, disconnect cleanup, no wallet-linked listening history | Retain Socket.IO |
| `room:create`, `room:join`, `room:resume`, `room:leave`, `room:closed`, `room:host-connection`, `host:heartbeat` | Atomic admission, capacity, authenticated resume token, timeout and denial reasons | Retain Socket.IO |
| `room:turn-capability` | Private, membership-bound expiring capability | Retain Socket.IO |
| `room:listeners`, `room:listener-count`, `listener:joined`, `listener:left`, `listener:ready`, `room:rename`, `host:renamed`, `listener:renamed` | Server membership authority, current roster, peer lifecycle and bounded names | Retain Socket.IO; host aggregate count only mirrored into optional Celerity observation |
| `room:reaction` | Valid membership, bounded rate, unique ID, short lifetime | Hybrid candidate: encrypted Product dual observation of server-accepted reactions; Socket.IO remains authoritative until live comparison |
| Typing | No current Socket.IO event | Not introduced |
| `room:chat` | Membership, acknowledgement, bounded retry/history, confidentiality if publicly gossiped | Hybrid observation for short encrypted Product messages; retain Socket.IO delivery/history, no Celerity receipt claim |
| `room:request`, `room:requests`, `room:request:remove`, `room:request:clear` | Attributed proposals, ack, host-only removal, full snapshot recovery | Hybrid observation of new encrypted accepted proposals; retain Socket.IO acknowledgement, host decisions and full queue reconciliation |
| `room:track`, `room:lineup`, `room:playback-mode`, `player:state`, `room:stream-ready` | Host authority, source stripping, snapshot convergence, periodic resync, silence stale playback | Retain Socket.IO |
| `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`, `peer:connected` | Private directed delivery, membership, retries, peer lifetime, glare handling | Retain Socket.IO; offline size experiment only |
| `webrtc:diagnostic` | Bounded operational disclosure | Retain Socket.IO |
| Audio, protected sources and keys | Authorized host only; ephemeral guest media | Never Celerity; WebRTC/TURN remains media transport |

The `RoomRealtimePort` types the existing event and acknowledgement boundary.
The Socket.IO adapter preserves reliable vs volatile delivery, timeout and
connection semantics. `useSession` retains media peers and room state. The
public-presence observer has no reference to this port. The private observer
uses it only for authenticated membership and observing accepted social events;
neither observer has room state setters or access/media services. Statements
cannot admit a guest, obtain a content key or change playback.

## Protocol and trust

The pinned Statement Store SDK 0.6.9 encodes JSON as UTF-8 using `encodeData`:
512 bytes maximum data per statement and 1024 bytes total account data. These
are data limits, not the size of a signed wire statement. The adapter uses the
SDK encoder rather than counting JavaScript characters.

The Product Host sponsored account signs statements. That is not a binding
between a publisher and Dotify's authenticated room host. Producer IDs are
random per observation session, not wallet or socket IDs; public observations are
untrusted measurements and never authoritative room counts. Public observers
can still correlate a room code and the allowance signer. Only hosts publish
aggregate presence; opted-in Product participants can publish encrypted social mirrors.

The public presence namespace accepts only a strict versioned aggregate payload. Unknown fields
or kinds (including chat, SDP, ICE, track state, sources and keys) are refused.
Room, message ID, producer sequence, creation/expiry, payload version and SDK
expiry are checked before bounded deduplication. Higher sequences supersede
older ones; a gap is a missing observation, not proven packet loss. Wall-clock
age is not one-way latency without a measured clock offset.

SDK 0.6.9's high-level receiver deduplicates by channel/expiry before application
authentication. It can suppress same-expiry messages, reordering, and valid
packets following an unauthenticated high-expiry packet. The room adapter keeps
the SDK publisher, Host transport and codec, but receives from that transport
directly with both exact app/scope topics checked. Dotify authenticates and then
deduplicates. Host/network filtering upstream remains outside these counters;
they are not a network-wide loss/duplicate rate. Discovery beacons retain their
existing SDK latest-value semantics; they are not a message log.
Publisher self-echoes have a separate diagnostic event and are not counted as
remote observations. These samples are untrusted even when a channel matches;
there is no authenticated room-host binding in this first slice.

## Private social observation

The opt-in private namespace now mirrors the sender's server-accepted reactions,
chat and new track proposals. It is an experiment on real application events,
not an alternate UI delivery path. Ordinary browser guests never initialize
Product, register a key or publish. No signing/account prompt is added to joining.

1. An admitted Product participant generates a non-extractable ephemeral Web
   Crypto P-256 ECDH private key. Only its public key is registered over the
   existing authenticated-by-admission Socket.IO connection (TLS in production).
2. The room service validates curve points, assigns a random producer ID and
   role from actual membership, and sends the versioned private roster only to
   registered members. Keys are immutable within that membership. Leave,
   disconnect and host resume revoke old IDs; closing the room removes the state.
3. Each pair derives a directional AES-256-GCM key through ECDH and HKDF-SHA256,
   bound to a random room scope and both producer IDs. All header fields are
   authenticated, with a fresh random 96-bit nonce and a 10-second payload TTL.
   This authenticates the counterpart to the recipient, not to third-party
   verifiers; it is not a host snapshot signature or wallet identity.
4. Public envelopes contain version, opaque scope, sender/recipient pseudonyms,
   producer sequence/message identity, creation time and ciphertext. They never
   contain a room code, display name, socket ID, plaintext social text or media key.
   Expiry is checked against both creation+TTL and the SDK expiry. Application
   payload version is bound to envelope version 2.
5. A 64-message sliding replay window accepts bounded reordering once. Crypto
   results spanning a membership revision or stop are discarded. There is no
   permanent archive, key storage or app-level automatic retry. A 16-event,
   ten-second in-memory FIFO preserves local order while one Host publish is
   pending; overflow or expiry drops only the Celerity mirror.

The room service remains trusted to bind peers honestly; a compromised service
could substitute keys. This is confidentiality against public gossip observers,
not an independent end-to-end claim against Dotify's admission service. Socket.IO
still carries the original plaintext room events, as before. Remaining members
cannot decrypt a different pair's ciphertext, but a recipient can retain a message
or key it already received; revocation does not retract old disclosures. There is
no double-ratchet or per-message forward-secrecy claim.

Messages over 160 UTF-8 bytes, or exceeding actual SDK encoding limits, are not
mirrored; they are never truncated. Each recipient consumes a separate statement,
so fanout is O(n) and the 1024-byte allowance is a meaningful limit. Public and
private publishers share local reservations, including a 512-byte beacon reserve
only when that build enables beacons. Failed or uncertain writes retain their
reservation until expiry. Queue overflow, quota pressure and unavailable
Product drop only the observation; the room's original delivery stays on
Socket.IO.
Reservations include one second for SDK expiry rounding. The adapter submits
only the payload's remaining TTL, never another full TTL after slow encryption;
crypto resumed after expiration is discarded before publish or acceptance.
Same-channel replacement can lose observations. A publish result is not a
delivery acknowledgement; chat/requests cannot move to Celerity authority yet.

Private snapshots/signaling remain excluded. No protected source or key, full
lineup, host control, SDP or ICE is accepted by this private schema.

## Host chat

Host 0.19.1 `ChatManager` supports `registerRoom`, `registerBot`, `sendMessage`,
`subscribeChatList` and `subscribeAction`. These operate the Host chat surface,
not Dotify's embedded chat. Invitations/Join actions are feasible UI candidates;
scheduled delivery, consent, deduplication and host availability need separate
evidence. A Support action may open Dotify's existing review flow, never sign
or submit payment. This slice does not register a bot or message a user.

## Offline signaling experiment

`node web/scripts/celerity-feasibility.mjs` uses the installed SDK encoder with
synthetic SDP, deflate, ephemeral X25519 shared-secret derivation and AES-GCM.
It is an offline probe, not production cryptography or authenticated key
agreement. Keys and raw SDP never leave the process. Bounded fragments are
reordered, deduplicated, authenticated and expired in the test harness.

| Synthetic offer | Compressed | Ciphertext with nonce/tag | Fragments | Total SDK data bytes |
| --- | --- | --- | --- | --- |
| 579 bytes | 324 | 352 | 2 | 626 |
| 2014 bytes | 819 | 847 | 4 | 1440 |
| 3934 bytes | 1474 | 1502 | 7 | 2543 |

Each fragment fits 512 bytes; the two larger examples exceed the entire
1024-byte account allowance. Even the smallest cannot coexist with a full
512-byte beacon reservation. Retrying the whole message doubles transmitted
data, not necessarily resident storage. These figures exclude signatures,
topics, key exchange, concurrent rooms and other allowance-account consumers.
Compression of these synthetic examples is not a real-device measurement.
Decision: retain Socket.IO for rendezvous. Mobile behavior, glare and actual
network retry reliability are untested.

## Capture and rollback

Follow [the paired Product capture procedure](../how-to/capture-celerity-room-realtime.md)
after a separately authorized candidate deployment. Its bounded opt-in recorder
correlates run-salted packet fingerprints, calibrates clocks via an admitted
Socket.IO connection and exports no plaintext or raw producer IDs. The offline
report distinguishes attempts, submissions, authenticated receipts, duplicates,
expiry, ordering and incomplete observation windows. It never certifies a
network-loss rate or marks W27 accepted automatically.

Acceptance review:

1. Record exact build SHA, appVersion/CID, SDK and Host versions, device/OS,
   network and foreground/background state for two Product clients. W13 pilot
   status remains separate from this owner-activated implementation.
2. Use `observe` for receive-only inspection; use `dual` for a host presence
   publisher. Both clients join the same canonical room through Socket.IO.
   A standalone guest must also join and hear the stream without an account.
3. Export stopped paired captures after controlled baseline, interruption,
   reconnect, background and expiry runs. Preserve separate diagnostic snapshots
   for degraded-state counters. Do not equate sequence gaps with loss.
4. Send a reaction, short chat and new request from each Product participant;
   compare private `submitted`/`accepted` counters, then test an over-budget
   message and extra peers. Private observation needs the updated signaling
   server; an older server times out without affecting the canonical room.
   Compare visible lineup/playback and guest sound throughout. All original
   social events and player mutations remain on Socket.IO and must work when the
   observer reports unavailable, rejected, interrupted or timed out.
5. Record Host-side submission/subscription evidence where available. Application
   observations cannot certify gossip-wide loss, deduplication or reorder.
6. Disable/rebuild with `VITE_DOTIFY_ROOM_REALTIME=off` on any permission,
   reliability, disclosure or quota concern. No server/contract rollback is
   needed. Reload or leave active rooms to stop their existing observers;
   in-flight Host submissions may still land and expire after their TTL.

The observer stops on startup failure or subscribe interruption. An eight-second
publish timeout is retained as an uncertain attempt, never replayed or relabeled;
the receive subscription remains active and a distinct queued event may proceed.
Counters are bounded to 200 in-memory events without payloads, room codes,
producer IDs or account addresses. They are operator diagnostics, not proof of
delivery or an aggregate pilot cohort.

## Wider Dotify responsibility inventory

The owner's expanded scope includes deciding what should **not** move. Celerity
fits short-lived discovery and bounded social signals, not every data flow.

| Surface / current owner | Decision and reason | Reconsider only when |
| --- | --- | --- |
| Public room discovery (`roomBeaconPublisher`, `roomBeaconDiscovery`) | Existing opt-in hybrid; expiring hints, with Socket.IO join/status validation | Two-client publish/discover/expiry evidence passes; no claim of joinability from a beacon alone |
| Room presence and short social events (new observers) | Hybrid observation, no authority migration | Paired real Product evidence meets each event's delivery/privacy needs |
| Solo listening aggregates (`presence:solo`, Music/galaxy counts) | Retain Socket.IO; disconnect-bound aggregation limits stale claims and avoids publishing wallet-linked listening history | Privacy, abuse resistance and aggregate authenticity are proven separately |
| Player, queue, admission, TURN capability (`useSession`, room service) | Retain Socket.IO; atomic membership, host controls and reconciliation are essential | An authenticated host snapshot protocol and equal guest/reconnect behavior exist |
| Catalog, release metadata and artwork (`useCatalog`, IPFS/bootstrap) | Retain durable API/content-addressed storage; expiring gossip is neither an index nor durable availability | At most an invalidation hint, never catalog authority, with measurable need |
| Artist publication/uploads (`useArtistConsole`, prepared uploads) | Retain authenticated server upload, IPFS and contract registration; no large/private payload gossip | No W27 migration planned |
| Protected content-key delivery, sign-in and entitlement | Retain signed API requests and fail-closed runtime read-back; public statements grant no access | No W27 migration planned |
| Payment/support journals, receipts, claims and runtime adapters | Retain existing native/Product transaction and persistent recovery flow; best-effort gossip cannot prove finality or recipient receipt | No W27 migration; CASH and PVM policies unchanged |
| Invitations, reminders and artist activity | Host ChatManager evaluated, not activated; consent, scheduling and action provenance remain unproven | Separate reviewed permission/retention UX and real Host evidence; Support only opens existing review flow |
| W13/readiness evidence and diagnostics | Local bounded capture plus explicit export; no automatic public gossip or durable listening archive | An explicitly approved operational data policy, not a transport flag |

Rollback triggers include an unexpected Product prompt, public plaintext or
identity disclosure, interference with guest audio, observation quota exhausting
other Product features, or a false delivery/authority claim. Disable the flag,
stop/reload observers and retain Socket.IO; no contract, entitlement or media-key
migration is involved. Do not delete the canonical path in this PR.

## References

- Installed `@parity/product-sdk-statement-store/dist/index.js` and exported types.
- Installed `@parity/product-sdk-host/src/chat.ts`.
- [Parity protocol explanation](https://www.parity.io/blog/what-is-polkadot-statement-store): best-effort gossip, no protocol confidentiality, delivery or ordering promise.
