# Keep short IPFS renditions reusable — 16 November 2026

**Implementation checkpoint: locally tested before delivery; no phone speedup claimed.**
The subsequent [API-only delivery](api-cache-rollout-2026-11-16.md) binds the served
image and remaining hosted/listening acceptance. The checkpoint below retains
its original pre-delivery scope.
Refs #395. Code `2ad0f84218d53d506e6fb38a64157e0f817fa2e0` starts from tested merged dev
`181765c11ef3811de57ba28d422b34e180469e1a`
([green CI](https://github.com/knzeng-e/dotify/actions/runs/43766033429)).
Web/Product remain 0.1.88 and server images remain the previously delivered
`91f25c77`. This change introduces no operational write authority.

## Reproduced failure and relevance

The [matching Wi-Fi phone report](product-0.1.88-rollout-2026-11-15.md#matching-phone-follow-up)
contains 73 authenticated objects, 10 local cache hits and 63 successful HTTP
objects, with 34.857-second preparation. A bounded read of the public catalogue
identifies the existing **Adang Fobe** release as ordinary encrypted v3 IPFS,
which dispatches to this reader rather than the separate Bulletin reader.
That read retrieves public metadata only, not audio, keys or private state.
It identifies the applicable code path; it does not observe server cache hits
or establish the cause of that recorded preparation delay.

The server ciphertext reader retains at most 16 MiB, but its 64-entry cap cannot
hold manifest/init plus 71 small segments even when all bytes fit. In the
controlled test, each object has 48 KiB of synthetic bytes:

| Sequential workload, same reader process | Upstream reads: first pass | Upstream reads: second pass |
| --- | --- | --- |
| Parent: 64 objects / 3 MiB | 64 | 0 |
| Parent: 73 objects / 3,588,096 bytes | 73 | 73 |
| Correction: same 73-object workload | 73 | 0 |

As replay admits the missing beginning, it evicts subsequent objects before
reaching them. The reader downloads the entire still-budgeted working set again.
This is a deterministic request-count result with a fake transport, not a
recording of artist data or an estimate of milliseconds saved on the phone.

## Decision and review path

1. `services/api/src/services/encryptedMedia.ts` raises the fixed entry bound from
   64 to **128**, retaining the existing **16-MiB payload bound** and LRU eviction
   when either bound is exceeded. The entry metadata allowance increases but
   remains bounded; the total process-memory peak is not measured here.
2. `services/api/src/routes/media.test.ts` reproduces the 73-object replay and
   checks both the 128-entry LRU boundary and independent 16-MiB eviction.
3. The unchanged `services/api/src/routes/media.ts` rechecks active/encrypted
   catalogue admission before the reader, including warm objects. Purpose/key
   authorization and manifest/media authentication remain client boundaries.

A larger byte budget is unnecessary for this reproduced working set. Increasing
request concurrency or extending the media deadline would change different
resource contracts without correcting eviction. Shared/distributed caching adds
another operational component and is outside this bounded process-cache fix.
The reusable cache contract belongs in
[Continuous listening](../../../explanation/continuous-listening.md#adaptive-delivery).

Only fixed immutable ciphertext objects are retained: no content key, clear
audio, archive/master, credential or listener identity is added. Two cold reads,
pending-read coalescing, cancellation, generation guards, gateway/redirect
policy, no-store responses and catalogue denial behavior remain. An ineligible
release cannot use a warm cache entry to bypass the route. Cache contents are
lost on restart and are independent per API process/replica; different titles or
larger renditions may still evict each other. The Bulletin block cache and
frontend cache are unchanged.

## Validation on the code commit

- The new 73-object regression fails on the parent with **146 rather than 73**
  total upstream reads across two passes. The entry-bound regression also fails
  before the change; the existing 16-MiB bound already passes.
- **13 targeted media tests pass** after the correction. Alongside the new
  regressions, they exercise current catalogue denial on cached bytes, two-cold-
  read admission, coalesced cancellation, clear-generation behavior, real local
  HTTP disconnect, truncated responses and reviewed gateway redirects.
- Typecheck, compiled API build and changed TypeScript format/whitespace pass
  with Node 22.23.5 and locked dependencies installed offline. No dependency or
  environment setting changes.
- **656 API tests / 43 suites pass**, including publication/recovery and
  existing media access/cancellation checks; zero skipped or failed tests.

The initial targeted invocation has an additional sandbox denial when its
existing HTTP-disconnect test tries to bind 127.0.0.1. The unchanged loopback
test is rerun with the required local permission and passes; neither its
assertions nor timeout is relaxed. The earlier exploratory invocation also
stops before scenarios because the original checkout lacks `multiformats`;
the isolated exact-source checkout then installs locked dependencies offline
and runs the probe successfully. No remote transport is used by these tests.

## Remaining gates

Review/full CI and a separately reviewed API image rollout precede hosted
validation. No Web/Product publication is needed to change this server reader;
clients stay 0.1.88. Actual cache reuse depends on routing, other requests and
process lifetime. The existing public-catalog read cannot establish which
replica served the phone or its cache contents.

First-pass work remains unchanged in the controlled test. The 34.857-second
phone result has unknown upstream cache state and still cannot separate server
retrieval from network wait. Keep that cold/pre-response latency investigation
open rather than promising this change will remove it. #395 remains open for
acceptable comparable startup and repeated/full-track audible continuity;
#388 remains open for repeated artwork reliability. No hosted image/config,
private Fly inspection, maintenance, signing, musical write, compact/CASH
activation or owner-deferred real recovery occurs in this implementation.
