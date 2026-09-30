# Room realtime transport decisions

W27 first slice, activated by the owner on 2026-09-30 before the remaining
W13 pilot evidence. This is permission to implement an opt-in experiment,
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
| `room:reaction` | Valid membership, bounded rate, unique ID, short lifetime | Retain Socket.IO until presence measurements justify a separate event migration |
| Typing | No current Socket.IO event | Not introduced |
| `room:chat` | Membership, acknowledgement, bounded retry/history, confidentiality if publicly gossiped | Retain Socket.IO; no chat enters Celerity |
| `room:request`, `room:requests`, `room:request:remove`, `room:request:clear` | Attributed proposals, ack, host-only removal, full snapshot recovery | Retain Socket.IO |
| `room:track`, `room:lineup`, `room:playback-mode`, `player:state`, `room:stream-ready` | Host authority, source stripping, snapshot convergence, periodic resync, silence stale playback | Retain Socket.IO |
| `webrtc:offer`, `webrtc:answer`, `webrtc:ice-candidate`, `peer:connected` | Private directed delivery, membership, retries, peer lifetime, glare handling | Retain Socket.IO; offline size experiment only |
| `webrtc:diagnostic` | Bounded operational disclosure | Retain Socket.IO |
| Audio, protected sources and keys | Authorized host only; ephemeral guest media | Never Celerity; WebRTC/TURN remains media transport |

The `RoomRealtimePort` types the existing event and acknowledgement boundary.
The Socket.IO adapter preserves reliable vs volatile delivery, timeout and
connection semantics. `useSession` retains media peers and room state. The
Celerity observer has no reference to this port or its state setters, so a
statement cannot admit a guest, obtain a key or change playback.

## Protocol and trust

The pinned Statement Store SDK 0.6.9 encodes JSON as UTF-8 using `encodeData`:
512 bytes maximum data per statement and 1024 bytes total account data. These
are data limits, not the size of a signed wire statement. The adapter uses the
SDK encoder rather than counting JavaScript characters.

The Product Host sponsored account signs statements. That is not a binding
between a publisher and Dotify's authenticated room host. Producer IDs are
random per observation session, not wallet or socket IDs; observations are
untrusted measurements and never authoritative room counts. Public observers
can still correlate a room code and the allowance signer. No listener publishes.

Only a strict versioned aggregate-presence payload is accepted. Unknown fields
or kinds (including chat, SDP, ICE, track state, sources and keys) are refused.
Room, message ID, producer sequence, creation/expiry, payload version and SDK
expiry are checked before bounded deduplication. Higher sequences supersede
older ones; a gap is a missing observation, not proven packet loss. Wall-clock
age is not one-way latency without a measured clock offset.

The SDK itself deduplicates before callbacks and hides some raw duplicates and
reordering. App counters therefore report only observations delivered to the
adapter, never a network-wide loss/duplicate rate.
Publisher self-echoes have a separate diagnostic event and are not counted as
remote observations. These samples are untrusted even when a channel matches;
there is no authenticated room-host binding in this first slice.

## Private events and Host chat

No private events are selected for publication. A future migration must first
establish authenticated, per-room key agreement and application encryption,
membership changes/rekeying, bounded message retries and private retention.
The SDK `decryptionKey` option is a filter hint, not encryption.

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

After a separately authorized candidate deployment:

1. Record exact build SHA, appVersion/CID, SDK and Host versions, device/OS,
   network and foreground/background state for two Product clients. W13 pilot
   status remains separate from this owner-activated implementation.
2. Use `observe` for receive-only inspection; use `dual` for a host presence
   publisher. Both clients join the same canonical room through Socket.IO.
   A standalone guest must also join and hear the stream without an account.
3. Export `window.__DOTIFY_ROOM_REALTIME__.snapshot()` from each client after
   controlled 60-second runs, network interruption, reconnect and expiry. Clear
   snapshots between runs. Record attempts/submissions/observations and duration
   distributions with clock calibration; do not equate sequence gaps with loss.
4. Compare visible lineup/playback and guest sound throughout. Reactions, chat,
   requests and player mutations remain on Socket.IO and must work when the
   observer reports unavailable, rejected, interrupted or timed out.
5. Separately measure raw loss/duplicates/reorder at a controlled Host transport:
   SDK callbacks suppress duplicates and cannot alone certify those rates.
6. Disable/rebuild with `VITE_DOTIFY_ROOM_REALTIME=off` on any permission,
   reliability, disclosure or quota concern. No server/contract rollback is
   needed. Reload or leave active rooms to stop their existing observers;
   in-flight Host submissions may still land and expire after their TTL.

The observer stops on subscribe interruption or an 8-second timeout. It does
not overlap retries of an uncertain publish. Re-enter the room or reconnect
to start a new observation session. Counters are bounded to 200 in-memory
events without payloads, room codes, producer IDs or account addresses. They
are operator diagnostics, not proof of delivery or an aggregate pilot cohort.

## References

- Installed `@parity/product-sdk-statement-store/dist/index.js` and exported types.
- Installed `@parity/product-sdk-host/src/chat.ts`.
- [Parity protocol explanation](https://www.parity.io/blog/what-is-polkadot-statement-store): best-effort gossip, no protocol confidentiality, delivery or ordering promise.
