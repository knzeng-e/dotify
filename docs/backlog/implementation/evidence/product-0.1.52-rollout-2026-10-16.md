# Product 0.1.52 coordinated rollout — 2026-10-16

## Artifact identities

The owner authorized deployment after #296/#297/#298 merged on `dev`.
Application base: `3b0bb68db9e669a3bd0baaabbf8bc1763f78c98f`.
The exact green, clean Product publication candidate is
`92a9c1179dfd1ac67a88c6b3838853c528ddc14c` (executable `[0, 1, 52]`).
It refreshes and freezes the 13-track public catalog and synchronizes fixture
metadata; it retains `product-cdm` / `devnet`, existing contracts and permissions.
Subsequent documentation commits are not the source of the published bundle.

- Root and executable CID:
  `bafybeicn6kz5i5yyuoalubbe3hsl7sr7qbunccysju5rki3wrtgi2dbz7m`.
- Ordinary Web: merged application base `3b0bb68`, independently confirmed in
  the public entry bundle after Netlify deploy `6ad2169182bc167db53545d6`.
  [Deployment](https://app.netlify.com/projects/muzinga/deploys/6ad2169182bc167db53545d6).
- Backend source: `0cd1e4b01b5642dc45cffe370aff2c6080ee8f5a`, an
  application-equivalent ancestor of the Product candidate. The later fixture
  metadata correction changes neither service. API `/version` confirms this SHA.
- API release **27**, one machine `802034f6565958`, image
  `registry.fly.io/dotify-api@sha256:cfb1b91fdc1f01df91d3a4cff7764b910d21438df2a5a3dcbf7b71536316013a`.
- Signaling release **33**, one 512 MB worker `d8d5205f929e28`, image
  `registry.fly.io/dotify-signal@sha256:438be7d8962109e2e63f6cdcc9b3d8b56d9b35ad88223f5dd06d929d2aa7fe73`.

## Deployment and security boundaries

API preceded signaling; each activation used a fresh fail-fast assertion of
zero rooms, listeners and solo listeners. Readiness passed after deployment.
The API now has a stable random server-only `SESSION_EPOCH`, staged through
stdin and activated with deployment. Existing content-key secrets were preserved.
Persistent catalog/revocation storage was verified present/writable. Both services'
bounded identity diagnostics confirmed `fly-client-ip` keying distinct from the
proxy peer; no raw address is included in this evidence.

Netlify initially served `974568c` and production followed `main`. During the
owner's dashboard intervention, production changed to `dev`; the operator then
triggered and verified the successful `dev` deployment. Future automatic deploys
therefore follow `dev`. No token was extracted from the browser.

Product used pinned deployment CLI 0.20.0 and live Host Remote Config verification
before/after publication. The signer was read only into process memory/child
environment from launchctl and removed in a `finally` block. Its removal was
independently checked. No mnemonic, content key or deployment credential is
included in the repository or this record.

## Publication and independent read-back

All 24 Bulletin chunks reached GRANDPA-finalized state after the CLI's bounded
re-upload/finality recovery. Root storage finalized before DotNS activation.

- Bulletin stable upload: block `1234085`,
  `0xdbbe3a1e625bc41f7fdcceac9c2e4ef96caa641f0eab26734cd270fb17fb6b1f`.
- Bulletin root upload: block `1234088`,
  `0x5aa4b22b3a14d78ea4263703c77493f0b6a6acc87ca69abfa2efef4040e24263`.
- Root content update: Asset Hub block `14513952`,
  `0xf230da53e1fe3f604e4c1b8608729c422de3b91b0b34c68543bdb59f069b6f92`.
- Atomic app content/executable update:
  `0xf202d9c27a9b912b821ab419d99d8fe4162bf4e3175d4f1e155530d36ceea9ed`.

A separate finalized Asset Hub read at block **14514002** confirmed matching
content hashes for `dotify-test01.dot` and `app.dotify-test01.dot`, and executable
text `{"$v":1,"kind":"app","appVersion":[0,1,52]}`.
The public DevNet gateway returned HTTP 200 and a **13,929,299-byte CAR** containing
the full published source SHA and entry `assets/index-BMfZ99CS.js`.
This verifies public retrieval and identity, not an installed Host's cache.

## Validation

[Exact-candidate CI](https://github.com/knzeng-e/dotify/actions/runs/38893782021)
passed, including all **265 browser scenarios**, Web/Product builds, API,
signaling and contract checks. Local deploy guards (20), frozen Product build,
strict catalog refresh, production environment checks, six DevNet checks and
live Host/CLI alignment passed. An initial fixture metadata drift failure was
fixed before publication; no track payload was altered by that correction.

Deployed synthetic checks passed:

- Default private room absent from discovery; anonymous code-based joining works.
- v3 nearby discovery accepts a 17 km host radius and 42 km search; returns
  a coarse 0–5 km distance band without wallet, source or cell fields.
- v2 clients retain their earlier response shape.
- Explicit worldwide discovery returns no fabricated distance.
- A joined member obtains a scoped TURN grant from the API.
- Acknowledged discovery opt-out removes the room from subsequent searches.

These checks used a synthetic coarse location, sent no funded transaction and
explicitly left/closed their own synthetic room. Aggregate health returned to
zero rooms/listeners/solo listeners afterwards. API readiness passed RPC, key
custody, directory, factory and storage checks.

## Remaining acceptance and rollback

Reload installed Desktop/mobile Hosts and confirm **0.1.52** before physical
acceptance. Check location permission/recovery, automatic scanning and progressive
room discovery, nearby versus worldwide/private visibility, displayed distance,
chat and prolonged multi-track audio on both Web and Product. Native paid tips,
artist publication and real media/cover availability still require physical
candidate-bound validation; CI/fake Hosts do not prove those capabilities.
Never repeat a paid tip just to restore a missing announcement.

Client rollback is Product **0.1.51**, CID
`bafybeihpprpso6vopekio67surwcygt2ygs6dnppdfsszmiul2qchib2me`, and the previous
Netlify deploy at `974568c`. Keep privacy-safe v3 signaling when rolling clients
back. Previous Fly tags `registry.fly.io/dotify-api:release-0.1.51-cdb9ac2` and
`registry.fly.io/dotify-signal:release-0.1.51-cdb9ac2` are retained for emergency
review, not a reason to restore globally enumerating discovery or remove the
stable session epoch. Recheck active rooms immediately before any restart.
