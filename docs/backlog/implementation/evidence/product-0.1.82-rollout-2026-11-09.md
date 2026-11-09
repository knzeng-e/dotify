# Publication reliability delivered — 2026-11-09

**Web, Product, API and custody 0.1.82 are published and independently verified.**
This delivers merged #413: effective Node deadlines, confirmed publication
progress and feedback that distinguishes wallet approval from catalogue
visibility. Refs #407. Publication/indexing speed and wider owner acceptance
remain open; this delivery does not establish acceptable publication latency.
[Structured public evidence](product-0.1.82-rollout-2026-11-09.json) preserves
source, finalized receipts, readback, capacity and service checks without keys.

## Exact source and authority

Frozen `release/product-0.1.82`, commit
`26430e566cf7bd70995007cd266152a562cd35b7`, starts from tested merged dev
`bccb20d5d70f30d41baafccc6939c11c68828a4d`. Only appVersion `[0,1,82]` differs.
Both [dev CI](https://github.com/knzeng-e/dotify/actions/runs/42538044047) and
[exact-source CI](https://github.com/knzeng-e/dotify/actions/runs/42540163615)
pass, including deterministic publishing/access/Room journeys and three-engine
streaming. The owner's separate approval covers the existing Fly image/code
upload, rolling both API replicas, custody maintenance, at most 20 app operations /
9,490,182 bytes and two DotNS requests. No new musical allowance, admission,
key installation, domain purchase, SDK/Host change or signaling update occurs.

## Artist-visible result

[The server/client repair](bulletin-publication-progress-2026-11-08.md) keeps its
Node timeout controller strongly owned, exposes confirmed-block progress only to
the job owner and orders backend audio/cover preparation. Whole-release recovery
has a two-hour overall cap; legacy/per-request/store/finality bounds remain short.
The interface follows advancing confirmed progress and hands back a saved pending
draft after bounded inactivity instead of claiming storage failure or success.

[The feedback repair](artist-publication-feedback-2026-11-09.md) separates wallet
approval from read-only catalogue visibility. An approved release awaiting
indexing receives confirmation and bounded automatic visibility checks, plus an
explicit read-only check; it never asks the artist to pay/publish again solely
because indexing is late. Completion still requires the matching canonical
catalogue entry. Account changes, dialog ownership and single-flight boundaries
remain enforced; full-page pending-operation persistence is not introduced.

The owner reported a new release visible and audible after a catalogue delay on
**0.1.81**. This is dated prior-version acceptance. On 0.1.82 the public catalogue
is fresh and contains the existing Black panther anthem, eight-second pilot and
Adang Fobe entries; that read alone does not establish audible output. Actual
Web/Desktop artist-area and listening checks have been requested, without a new
upload or purchase.

## Finalized application and Web evidence

Actual application operations: **12 stores / 3,590,405 bytes**,
**8 one-off renewals / 5,899,777 bytes**. All twenty distinct
CIDs consume exactly 9,490,182 accounted bytes, using Bulletin nonces 1642–1661.
Two finalized DotNS requests use Asset Hub nonces 488/489 and update only the
root manifest and `app` executable of `dotify-test01.dot`. The independent lab
stays 0.3.1. Each intent is journaled before signing and bound to its exact call,
chain and nonce; uncertain writes are never automatically resubmitted.

CAR SHA-256:
`3fc289ca83962b2a4ffd71fe38f53a7a038ec14315263c09328aa361f54d0453`.
App root: `bafybeigqmu3ys3wfpxlii7lk3r5u6j7eqnbrvh7rbueqqmsydvtlfsrvnu`.
Offline verification authenticates 99 CAR blocks and byte-compares 71 files.
Independent finalized readback retrieves and byte-compares all twenty outer
objects, checks canonical retention and both DotNS records. Every renewal
extends retention. Earliest dependency expiry: **1766849**; authorization expiry
is separately **1621405**. The final account nonce is **1662**.

Netlify serves `index-BDhFNon1.js`, 1,152,114 bytes, SHA-256
`006e8ae0dfb1bfbfb5e1c564922fc0a84228d44c379a4d3987bbb48f75d827e1`.
All nineteen Web files / 1,832,396 bytes match a reconstruction of the frozen
source and public environment. Netlify's `clean=false` build metadata is matched
using only a temporary untracked marker in an isolated same-SHA worktree; no
application source is changed, and the marker is removed. Public configuration
digest matches. Mobile-size Chromium boot has no uncaught error, key, auth or
upload request; this is a shell check, not listening acceptance.

## Maintenance, persistence and rollback

All three existing Fly machines run immutable image
`registry.fly.io/dotify-api@sha256:431a80dfa9a924e109c0b90d9c9aff223bf17a532bb59cda7a6b92a24ebf0f24`.
Linux amd64, revision label and UID 1000 are verified. Both key-serving API
replicas rolled individually; custody was stopped only after confirming no
active job, pending intent or writer lock, then remained stopped throughout
shared-account app writes. After finality and readback it restarted successfully.
All three report source `26430e56`, health/readiness 200, active v3 with retained v2.
Other environment, resource, role, check and mount settings are unchanged.

**All nine tracked private profile/admission/queue/inventory files are byte-identical
before and after maintenance.** Five owned ready inventories remain settled.
The durable custody cursor stays 1642 while finalized chain nonce advances to
1662: this is the supported monotonic handoff between fully settled jobs, not a
reason to rewrite/reset the cursor. No server key is exported or replaced. The
local signing variable is cleared immediately during private FD handoff and its
absence is checked again after completion.

A completed pre-maintenance volume snapshot exists; it is recovery support, not
proof of off-provider backup or full restore. A synthetic network-disabled
old-to-new final-image rehearsal verifies owned ready-state readability without
modifying either journal and a deadline surviving forced GC under Node 22.13.1.
No production signer, key or musical asset is used by that rehearsal.

Rollback image:
`registry.fly.io/dotify-api@sha256:c515d84b820eb23671b246163b2e1021ca9efeb71770c4bba93bc58576dc7f47`.
Previous app root remains in the structured evidence. Retain all journals on
rollback; an uncertain signed operation must be reconciled before writer restart.
The exact DotNS ceiling is consumed, so a later domain rollback needs a separate
reviewed signature budget. No schema/data migration or fresh-domain reset occurs.

## Capacity and remaining acceptance

After publication: **2,719 transactions**,
515,370,541 store bytes and 604,234,496 renewal bytes remain.
Preserve the full previous conservative reserve, including both entire old
musical allowances even though partly consumed, plus all twenty app dependencies:
**1,183 future operations / 320,588,055 bytes**. The preflight also conservatively
reserved all 712 earlier musical writes separately from immediate app operations.
Quota covers that plan without extension. The installed immutable profile stays
unchanged; future operator checks must carry the extra app reserve in this record.
No automatic renewal, musical write or new admission is activated by delivery.

#407 stays open for acceptable publication/indexing latency, further authorized
long-publication acceptance and wider actual-client evidence. A longer timeout
or successful catalogue read is not a throughput improvement, sound test,
public-pilot conservation guarantee or new payment capability.
