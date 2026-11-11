# API schema security migration

GitHub: #432. Priority: P1. Track: Production spine. Phase: Next. Type: Work.
Status: separate follow-up; no migration or deployment authorized by this record.

API Zod 3.25.76 remains affected by [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
The fix is in v4.6.6+; importing the v3 compatibility module from a v4 install
would keep the vulnerable validator. The [upstream patch](https://github.com/colinhacks/zod/commit/a0ebf97)
checks collection cardinality before parsing elements.

The #431 candidate bounds parsed network JSON before Zod (including scheduled
nodes, depth, collection/property/string sizes) and retains the 1-MiB parser and
50-KiB metadata byte caps. This limits the confirmed public request amplification
path but does not remove the advisory or migrate private state.

Migrate real route and persistence schemas to patched v4 with tests for typed
errors, strict unknown-field refusal, canonical serialization and existing
profile/admission/journal digests. Preserve account/nonce history and old ready
releases; never recreate rejected state. Retain raw JSON and multipart limits as
defense in depth. A service rollout remains separately reviewed.

This is a public-pilot security gate alongside conservation and access acceptance,
not new payment/media capability. #407 format integration and Room/artwork/CASH
keep their selected sequence; do not smuggle this major upgrade into an SDK
refresh or force a signer downgrade. Code completion requires full API,
shared-state, publication/recovery and old-state compatibility evidence.
