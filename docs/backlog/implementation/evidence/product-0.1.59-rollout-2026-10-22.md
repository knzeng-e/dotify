# Product 0.1.59 artist bootstrap correction, 2026-10-22

Refs #317. Product-only follow-up to the coordinated 0.1.58 streaming reset.
Source: merged dev `9ba2008eb0a9249f7eb630a7139b133cae3c038d` (#323).

## Published scope

Executable `[0,1,59]` keeps product-cdm/devnet, existing permissions and the
frozen empty catalog. The shared Product contract adapter uses the successful
native dry-run peak storage deposit, preserving failure and signer boundaries;
factory writes wait for finality. See [the isolated cause and validation](product-artist-bootstrap-2026-10-22.md).

This publication does not restart API 29, signaling 37 or private encoder 1,
change contracts/CDM, recreate an artist runtime or submit the artist's write.
The existing pending runtime must resume through the artist's normal approval.
The [0.1.58 record](product-0.1.58-rollout-2026-10-22.md) retains server/custody
and reset evidence. A rollback to 0.1.58 restores the known bootstrap defect;
pre-reset clients are not a standalone rollback for the new directory.

## Verified publication

Published from clean packaging `627b4fa2399ab84ac5081aa8c6a7210761381a57`. Exact merged-source CI
39758674801 and packaging CI 39760327223 pass all jobs, including Product/Web
builds, browser core flows, three-engine streaming and Product identity checks.
The local frozen build and live Host Remote Config profile check pass. Existing
large-chunk build warnings remain; this is not a bundle-optimization change.

Independent finalized readback at block 14762875 confirms root
`dotify-test01.dot` and executable `app.dotify-test01.dot` both resolve to
`bafybeia7d6qbsqq7tj32tgvzc3z3vr3x6cxhtlyve6fc3k52zqeqmjhhum`, with app manifest `[0,1,59]`.

- Root contenthash transaction: `0xe330619e3b10e4fab3fedcef3b21b43249e2b7ca86a30513c995b5dab3a577af`.
- Executable manifest transaction: `0xdf500415d8470cfa84e9ca37a4082ca47e7f1ca0a281626b4b2c468d47db272a`.
- Public CAR: 13,936,295 bytes, all 124 SHA-256 block hashes verified;
  archive SHA-256 `6eac218f893bb968bce3812542a1a9f4b2ed482ddcdb58b895d9321ac8bd1db2`.
- Inner UnixFS directory: `bafybeihj74jd7tunroinjqhbxmlknlqjqciu66h2566fxiuk7djicujklu`, equal to the local directory merkleization.
  DotNS names the transport DAG, not this inner CAR root.
- Exact index and entry bytes match the signed local build. Entry `assets/index-BEUPAD3p.js`,
  SHA-256 `76bf38cac5069d62915bd5f146b25e2998cfa714e54fc475ca94ff48bbe11a95`, embeds the exact packaging SHA above.
- Live API readiness and signaling health remain healthy; no services were
  restarted. The local DotNS signer was removed and its absence verified.

These checks prove publication and artifact identity. They do not prove an
installed Host has reloaded its cached executable or that the artist has
completed the funded bootstrap approval.

## Remaining acceptance

The artist retries the existing stage-7 setup. Confirm pending stage clears,
the directory registers that same runtime and its owner is the artist. Only
then validate real original publication, playback and value flows on physical
Product/Web. No operator approval substitutes for that evidence; #317 stays open.
