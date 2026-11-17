# Web/Product 0.1.88 delivery — 15 November 2026

**Published and independently verified; one matching Wi-Fi phone check passes, with preparation still slow.**
Web and `dotify-test01.dot` serve frozen `4cbdb4f4206f91470eb6097ade8f23093f4aa840`, based on tested dev
`bbfaae560292979ea0cad1b54810e8b52f7a7d39` after #475. The only tracked packaging change is appVersion
`[0,1,88]`. Refs #395. The [structured public evidence](product-0.1.88-rollout-2026-11-15.json)
contains allowlisted identities and aggregate checks. Private journals, protected
state fingerprints, inspection reports and signer material remain outside Git.

## What listeners and support receive

The [read-phase diagnostic](room-read-phase-timings-2026-11-15.md) separates settled
relay admission, native-path probes, HTTP headers and body work in the existing
explicit local support report. These measurements help choose the next bounded
latency correction without changing artist access or playback behavior.
The [measurement guide](../../../how-to/measure-room-startup.md#distinguish-transport-phases)
owns field meanings and coverage limits; this delivery does not duplicate that
contract or claim a speedup or native-artwork correction.

Counters remain bounded page-memory observations, shared only through the
existing copy action. No extra request, retry, timer, persistent history or
telemetry service is introduced. Export excludes URLs, account/Room/track
identities, keys and raw errors. Old reports remain readable, but cannot supply
these new fields retrospectively. Settled parallel work overlaps; header wait
cannot isolate network round-trip time from server or connection work, and
unfinished/custom transport work can be absent from a snapshot.

Keeping the existing limits permits diagnosis before retuning them. The same
purpose authorization, authenticated objects, two-body HTTP relay, solo priority,
four complete-file workers, 40-MiB cap and 60-second media budget remain.

## Exact delivery and independent checks

[Parent dev CI](https://github.com/knzeng-e/dotify/actions/runs/43702709171),
[exact candidate CI](https://github.com/knzeng-e/dotify/actions/runs/43703054048),
[unsigned Product validation](https://github.com/knzeng-e/dotify/actions/runs/43703060269)
and [Host/DotNS alignment](https://github.com/knzeng-e/dotify/actions/runs/43703067699)
pass. Locked dependencies build with Node 22.23.5; **38 focused tests / six files**
pass on the exact release source. The code checkpoint records 1,223 unit tests
and 18 Chromium/WebKit synthetic AAC/crypto cases, including failure/cancellation,
observer isolation and privacy/export checks. Existing Vite chunk-size warnings
remain. These checks do not establish native phone audio or artwork acceptance.

| Observed delivery fact | Value |
| --- | --- |
| Application root | `bafybeielip24ywdkjeu6bvi47oqg4gevb5uoms4f3rapbjg2tnqx4gjop4` |
| CAR SHA-256 | `606de066998e1518e2e98a40d2e68c75e994f16ec5713635ad85040eb709f3e1` |
| Offline reconstruction | 100 authenticated CAR blocks / 72 byte-compared files |
| Actual application operations | 12 stores / 8 one-off renewals; 20 exact objects / 9,515,357 bytes |
| DotNS / music | 2 signatures / zero musical writes |
| Independent Bulletin readback | Block 1661868; all 20 objects byte-compared and retention verified |
| Earliest application expiry | Block 1863354 |
| Conservative retained reserve | 2,371 future operations / 604,354,885 bytes |

Finalized root/app DotNS records bind the same application root and appVersion;
the separate lab stays 0.3.1. This record grants no future write or automatic
renewal.

The owner publishes Netlify using the existing site/settings. All **20 served
files / 1,856,700 bytes** match the independent reconstruction.
Hosted `clean=false` metadata is reproduced with a non-code untracked marker in
a separate checkout; the marker is then removed. Entry `./assets/index-BCrPfLAb.js`
has SHA-256 `0f34f969e9074bbfa3dfe50fc5d8841ea8683442776b46a201ba8fae0bac06cc`. The 390×844 public shell opens without JavaScript
errors or sensitive account/upload/key requests, with mutating methods blocked.
This proves served identity and shell behavior, separately from physical listening.

## Maintenance and trust boundaries

The owner approves the exact application budget and temporary custody exclusion
from the shared storage account. Fresh private metadata inspection finds no
active or uncertain work, and compares protected state and retained obligations
with the prior completed delivery. Custody is initially running; the conditional
isolated waiting-process diagnostic is not needed for this successful attempt.
One same-machine stop precedes writes. Persisted signing intentions bind the
exact graph, call, chain and nonce; uncertainty stops automatic replay.

Earlier local attempts spend none of this budget. The first stops at signer
handoff with an empty transaction journal; its exact cause is not established,
and unchanged public state permits a guarded same-image service restoration.
A second refuses mnemonic decoding before maintenance. A third verifies the
expected public account but expires while awaiting the chat-driven gate, before
any stop or transaction. Original reports are preserved privately and reconciled
without resubmission. The final masked Terminal flow validates the account and
runs fresh gates, publication and verification directly, avoiding that human
handoff delay; no signer value is placed in its arguments, environment or files.
Nine controller fixture tests and masked pseudoterminal checks cover scope,
quota, idle-state, partial-journal and one-start recovery boundaries without
real keys, network writes or maintenance.

After independent storage/retention and finalized-DotNS verification, the same
machine restarts once with unchanged image/settings and server source `91f25c77`.
Health/readiness return 200 twice; protected metadata and permanent nonce-tree
fingerprints are unchanged. The first post-start read-only health observation
is unavailable; a later machine observation and verification-only health/state
checks pass without a second start. The cause of the initial unavailable
observation is not established.
The public API still identifies the previously delivered server source.
The signer child has exited, the local signer variable is absent, and this
version's write authority is consumed. No server image, key, admission, musical
budget, access policy or Host/SDK setting changes. Compact/CASH activation,
automatic renewal and the owner-deferred real independent recovery remain
outside this delivery; existing artist assets remain.

## Matching phone follow-up

The owner reports **34 s**, respected Pause, audible guests during phone lock and
visible lock-screen artwork on **Wi-Fi**, Polkadot app **0.10.0 (20)**. The matching
report identifies this exact `4cbdb4f4` build, observed at
`2026-11-15T20:23:37.353Z`. Requested context is existing **Adang Fobe**, without a
connected wallet, solo then one Room opening. The owner also describes an earlier
separate opening in about **27 s**, whose Room closes after prolonged inactivity
before the protocol finishes. That earlier run has no matching supplied report;
it is neither a demonstrated preparation timeout nor a cold-start benchmark.
This report captures the later successful opening, not that prior run.

| Observation | Value and scope |
| --- | --- |
| Owner's approximate opening time | 34 s; separate from instrumentation |
| Authorization / authenticated manifest ready | 196 ms / 199 ms |
| Complete download / prepared source ready | 34,846 ms / 34,857 ms |
| Local assembly after download | 11 ms |
| Authenticated objects / encrypted bytes | 73 / 3,580,693 bytes |
| Cache / native Host / HTTP / recovered | 10 / 0 / 63 / 0 objects |
| Overlapping read / decrypt work | 130,429 ms / 65 ms |
| Relay-slot waiting work | 66,944 ms; cumulative, overlapping waits |
| HTTP headers / body work | 63,111 ms / 313 ms; cumulative settled phases |
| Native probes / HTTP requests / body reads / HTTP failures | 0 / 63 / 63 / 0 |
| Longest complete object read | 10,860 ms, including admission/transport |

Read work concentrates in relay admission and pre-response HTTP waiting; body
consumption, authentication and assembly are short. These totals overlap and
cannot be added to the 34.857-second wall time. The existing API route waits for
the complete ciphertext object before sending it, so client header wait can
include upstream retrieval, server processing, browser scheduling, connection and
network delay. It is not pure network round-trip time or proof of one server
bottleneck. No HTTP failure/fallback is observed in this complete preparation.
Zero native probes means the native path is not used in this try, not that it
fails. The [measurement contract](../../../how-to/measure-room-startup.md#distinguish-transport-phases)
defines these boundaries and incomplete-coverage limits.

The normal prepared-source handoff is attempt 3: reauthorization/reuse takes
245 ms and element metadata readiness another 164 ms from source selection. It
is not another user Room retry. Output stays paused at **11.669695912 s** through
source replacement until the later explicit Play intent. Generation 2 then has
hidden→visible observations **58.947 s** apart, with about 58.949 s of context and
58.948 s of media advancement. Those clocks accompany, but do not prove, the
owner's audible lock result; actual lock duration is not separately restated.

Artwork is decoded in 2 ms, composed in 22 ms and assigned as PNG metadata at
25 ms. The owner sees the lock-screen cover this time. This is a positive bounded
device check; metadata assignment still does not acknowledge native display.
The prior [0.1.87 absence](product-0.1.87-rollout-2026-11-15.md#matching-phone-follow-up)
remains evidence, and this diagnostic release changes no artwork behavior.
Do not close #388 on one successful appearance or claim a rendering correction.

The 0.1.87 report has the same 10 cached / 63 HTTP counts, but different upstream
cache/network conditions and the earlier separate run are uncontrolled. Neither
34.857 versus 36.955 seconds nor the untraced 27-second opening establishes a
speed gain. Keep the successful protocol distinct from repeated/full-track and
latency acceptance.

## Next acceptance

Investigate the bounded pre-response path and its effect on the existing relay
queue before changing capacity or deadlines. Source inspection identifies the
catalog refresh/admission hook, server ciphertext reader/cache and upstream
retrieval as distinct possible contributors; this report does not select a cause
among them. A controlled reproduction or finer server-side phase evidence must
precede a claimed correction. No live service inspection, configuration change,
maintenance, signer or musical operation occurs in recording this feedback.

#395 remains open for acceptable comparable startup and repeated/full-track
audible continuity. #388 remains open for reliable native artwork, while this
successful appearance and earlier absence are both preserved. Public-pilot
access/value-flow and owner-deferred recovery gates remain separate. No repeat
is requested solely to replace this valid observation.
