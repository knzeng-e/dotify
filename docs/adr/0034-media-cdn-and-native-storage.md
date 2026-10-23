# ADR 0034: reuse the dedicated IPFS CDN before adding another distribution operator

- Date: 2026-10-22
- Scope: W33 / #288, refs #88
- Decision: implement a provider-neutral immutable ciphertext path; select the
  owner's existing dedicated Pinata gateway/CDN as the first activation candidate.
  Do not activate it while it refuses the current published content.

## Context and options

Authenticated v3 streams are small manifest/init/segment objects, not the
retired DAV2 file/range format. The bounded API relay is already implemented,
uses two cold reads and a 16 MiB ciphertext cache, and remains the recovery path.
Content keys and access checks must never enter a CDN. Reusing an existing CDN
avoids account creation, a new bill and another cache invalidation boundary.

| Option | Delivery/cache model | Cost and operations | Measured latency / readiness |
| --- | --- | --- | --- |
| Existing dedicated Pinata gateway/CDN | CID-addressed IPFS retrieval with managed edge cache, upstream pinning in the same service | Existing owner gateway; plan not inspected or changed. Public Picnic listing is $20/mo with 500 GB bandwidth and stated overages, not a promise of this account's entitlement. Verify dashboard limits before activation. | Six authorized probes across three regions show the candidate returns 401 everywhere; blocked until provider content/access settings are corrected. |
| Cloudflare Cache API in front of a dedicated origin/API relay | Explicit Worker cache and CORS/range policy; Cache API cache is local to a data centre, not tiered automatically | Another account/deployment/monitoring boundary. Paid Workers has a base subscription plus request/CPU usage; obtain a current quote and spending limit before activation. No account or Worker was created. | Not deployed or measured; no latency superiority claimed. Does not solve an origin 401. |
| API read-through alone (baseline) | Registered v3 object admission on every read, fixed public IPFS fallback, small process cache | Existing Fly API; geographic round trips remain | Helsinki/Buffalo/Tokyo return 200; baseline transport evidence below. Kept as recovery. |
| Product Cloud Storage/Bulletin | CID storage and Host/light-client retrieval, not an HTTP CDN contract | Requires storage authorization/quota and Host capability; currently container-specific retrieval | No media migration in W33, no claims of multi-region audio first sound or ordinary-browser parity. Evaluate later with both Web and Product measurements. |

Primary references, checked 2026-10-22:

- [Pinata dedicated gateways and built-in CDN](https://knowledge.pinata.cloud/en/articles/6297294-public-gateways-vs-dedicated-gateways)
- [Pinata plans and bandwidth](https://pinata.cloud/pricing)
- [Pinata gateway access controls](https://docs.pinata.cloud/gateways/gateway-access-controls)
- [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Product storage architecture](https://docs.polkadotcommunity.foundation/architecture/storage/)
- [IPFS immutable path cache semantics](https://specs.ipfs.tech/http-gateways/path-gateway/)

## Trust and delivery boundary

The app tries configured CDN `/ipfs/<cid>/<fixed object>` first, then the
existing catalog-gated API relay, then existing IPFS gateways. It sends no
cookies, authorization or key. URLs cannot carry credentials/query/fragment.
Every returned object is still checked against the authenticated manifest and
AEAD by playback. A CDN has no entitlement or plaintext authority. It can cause
delay or withhold bytes, not authorize access. An invalid object fails closed.

The API can prefer the same dedicated Pinata origin on relay misses, retaining
reviewed HTTPS redirect hosts and public fallbacks. API responses stay no-store
and eligibility is rechecked; this does not turn the API into an unrestricted
immutable public proxy. IPFS remains the source of truth.

Pre-warming follows successful persisted, confirmed catalog synchronization,
not raw upload completion or an unapproved release draft. Up to seven public
startup objects (manifest plus init/first segment at each bitrate) are requested
with no credentials. Bounds: two concurrent jobs, eight admissions/minute,
queue eight, byte/time limits and three attempts per continuously observed CID.
Failures never fail publishing/indexing. Restart loses only warm bookkeeping,
not key/replay/revocation state. One warm request does not warm every CDN region.

## Evidence and consequences

[Six anonymous probes](../backlog/implementation/evidence/W33-regions-2026-10-22.json)
were explicitly authorized by the owner and ran against the two public manifest
URLs only, reusing the same regional probes. The diagnostics contain locations,
status and timing, not IP addresses, bodies, keys, accounts or listener data.
They do not measure audible first sound, and a 401 latency is not a delivery win.

Select Pinata operationally, but leave client/prewarmer variables unset until
that gateway returns the exact current ciphertext with public CORS and immutable
cache headers. Then repeat paired cold/warm HTTP and real first-sound tests from
three regions on Web/physical Product. #288 remains open until these gates pass.
No Cloudflare/Bunny scaffold or unused fallback storage adapter is retained.
