# ADR 0037: measure room ownership before scaling signaling or audio

Status: research decision; no production activation. Date: 2026-10-29.
Refs [W39 / #294](https://github.com/knzeng-e/dotify/issues/294).

## Decision

Keep the current single signaling instance and 24-guest ceiling for the deployed
pilot. Do not buy or deploy a Redis service, SFU or second region from a local
benchmark. The next production increment should be room-state recovery and a
controlled drain, followed by an optional host-stream SFU only if real room
size/uplink evidence justifies it. This work does not shorten solo first sound.

The [isolated runnable experiment](../../research/room-scaling/README.md) and
[measurements](../backlog/implementation/evidence/W39.md) answer feasibility,
not installed Product acceptance. No app/server deployment code imports it.

## What needs to be shared

Adding the Socket.IO Redis adapter distributes packets, not the application
`rooms` Map. The actual Dotify server still rejects a cross-instance join and
cannot resume a room after process replacement. Its current `room:resume`
credential is checked against the local record; a draining shutdown alone
cannot recover a record that no longer exists.

The smallest investigated model has these distinct responsibilities:

- A bounded shared room record holds the host credential hash, current owner,
  monotonically increasing ownership epoch, room expiry and authoritative
  membership. One atomic operation handles admission and the audience cap.
- A short owner lease prevents concurrent ownership. Takeover waits for expiry
  or an explicit drain; an epoch fences future writes from the former owner.
  Successful takeover rotates the host resume credential.
- A separate adapter routes events to socket connections on both instances.
  It is transport, not authority. A sequenced snapshot/reconciliation protocol
  must recover missed events and reject packets from a stale ownership epoch.
- State writes fail closed when shared authority is unavailable. Packet delivery
  already in flight cannot be recalled by a fencing token.

The prototype checks this reduced model, including concurrent admission,
credential replay, planned transfer, forced owner death and Redis outage. It
intentionally does not implement production chat/queue replay, all member
expiry, privacy/discovery leases, artist verification, SDP/ICE authorization,
TURN proofs, tip attestations or shared abuse limits. Those cannot remain
process-local in a production design.

## Routing, recovery and privacy

HTTP long-polling requires affinity for each Engine.IO session even with an
adapter. WebSocket-only avoids that particular requirement, at a compatibility
cost; do not remove the existing polling fallback from Product without device
checks. Fly's `fly-replay` can route an HTTP request to a chosen instance, but
this experiment does not exercise Fly affinity or migrate an established
WebSocket. A room-owned route also needs a trusted ownership lookup before the
upgrade and a bounded, non-looping fallback on owner loss. [Socket.IO multi-node
guidance](https://socket.io/docs/v4/using-multiple-nodes/),
[Fly routing](https://docs.fly.io/networking/dynamic-request-routing).

Redis Pub/Sub has no packet replay and its adapter does not implement connection
state recovery. Redis Streams or explicit application snapshots are alternatives;
neither automatically shares Dotify's application state. Redis messages are not
signed/encrypted by the adapter. A future deployment needs isolated private
networking, authentication/TLS, narrow credentials and channel namespaces. Do not
use the W36 trust-state administrator or reuse API/custody secrets.
[Redis adapter boundaries](https://socket.io/docs/v4/redis-adapter/).

A safe drain stops new ownership, preserves room state and reconnects the host
and guests before releasing the old instance. Explicit room closure must revoke
that room's recovery. Link-only rooms stay absent from discovery; Nearby expiry,
Worldwide visibility and artist-only aggregates must be derived from the same
shared authority. No wallet, signature or payment gate may be introduced for a
guest. Local metadata recovery does not establish uninterrupted WebRTC audio.

## SFU alternatives and cost

An SFU forwards the host's live encoded stream to the audience. The authorized
host remains the only holder of content keys and protected source files.
Ordinary WebRTC terminates at the SFU: the operator can inspect or record media.
No end-to-end media secrecy is claimed. A future token service must verify live
Dotify membership, grant publish rights only to the current host, bind short-lived
credentials to one room and revoke admission on close. The synthetic experiment
mints these restricted tokens locally, without claiming a production join API.

| Choice | Benefit | Cost and operational boundary |
| --- | --- | --- |
| Current host-to-guest star | No new media operator; deployed fallback | Host sends one stream per guest; physical uplink/battery capacity is unmeasured |
| Self-hosted LiveKit | Complete signaling/SDK stack; local 25-guest prototype | Operate room admission, public UDP/TCP/TURN, monitoring and upgrades; one room must fit a node; VM and egress costs remain |
| mediasoup | Low-level control of host-only forwarding and placement | Build signaling, admission, reconnect, workers/routers, transport and regional orchestration; not benchmarked here |
| Managed Cloudflare Realtime SFU | Provider handles media distribution; published egress pricing | Dotify still owns admission/signaling; external media trust and provider dependency; not provisioned or benchmarked here |

LiveKit's own [benchmark guidance](https://docs.livekit.io/transport/self-hosting/benchmark/)
uses synthetic participants and distinguishes room capacity from node count.
[mediasoup scaling](https://mediasoup.org/documentation/v3/scalability/) describes
workers, routers and explicit signaling between nodes. Published provider
figures are not Dotify capacity guarantees.

For a transparent example, **25 guests at an assumed 128 kbit/s for one hour**
mean 1.44 decimal GB of media egress, before retransmission/protocol overhead.
The star needs about 3.2 Mbit/s host uplink; an SFU needs about 128 kbit/s host
uplink plus its audience egress. This is arithmetic, not a measured bandwidth
or hosting quote. SFU forwarding does not remove aggregate network cost.

As checked on 2026-10-29, Cloudflare lists $0.05/GB after a shared first 1,000 GB
monthly SFU/TURN allowance. The illustrative 1.44 GB would cost $0.072 if fully
billable, excluding other services. These are provider terms, not a Dotify
spend commitment. [Official pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/).
LiveKit Cloud is another managed alternative; it meters connection time and data
rather than offering a flat unlimited room cost. The same one-hour 26-participant
example is 1,560 participant-minutes. [Official billing](https://docs.livekit.io/deploy/admin/billing/).

## Region decision and bounded follow-up work

No second region is selected: there is no current candidate-bound multi-continent
room measurement in this experiment. Keep Amsterdam until #89/#158 provide
actual independent-network RTT, jitter, packet loss, reconnect and audible
results. Local Docker/native loopback cannot rank regions or providers.

These are the explicit follow-up scopes, **not activated by this PR**:

| Work package | Acceptance before activation |
| --- | --- |
| Shared room authority and consented discovery | Migrate bounded room/membership/expiry state, authorization, privacy visibility and abuse limits; verify anonymous joins and all failure boundaries on two instances |
| Drain, snapshot and reconnect | Preserve explicit closure and host identity; reject stale epochs; recover chat/lineup/listeners; measure actual uninterrupted host/guest audio on Web and Product under deploy and crash |
| Optional SFU admission and room transport | Room-scoped host-only publication, guest subscription, revocation, fallback and explicit media trust; verify native capture, TURN, 25+ listeners and real uplink/egress costs |
| Region and capacity decision (#89/#158) | Collect consented per-network timing/quality without raw IPs, precise location or wallet-linked listening history; choose region only from those measurements |

No live room, contract, key, hosted setting, paid resource or audience cap is
changed here. The prototype is disposable; deleting it rolls back the research
without a data migration. Keep its conclusions and raw synthetic evidence.
