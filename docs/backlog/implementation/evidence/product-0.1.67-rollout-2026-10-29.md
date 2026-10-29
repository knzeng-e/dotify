# Product 0.1.67: publication recovery

Deployed on 2026-10-29. Refs #287/#317; their physical-device and pilot gates
remain open. Application source is merged #351,
`5e2105e3d1d7017cf443dfc6d181b42e6ac67f93`; clean Product packaging is
`89c2595788c96350df40a128aa7bb2a63d20226c`.

## Published identities

| Surface | Verified identity |
| --- | --- |
| Product executable | `[0,1,67]`, product-cdm/devnet, unchanged Host permissions |
| Root/app transport CID | `bafybeihiyvg3rce23zdort7fwyvpqtdzo5vvaourwagcdtejwlb72ma4oy` |
| Web | Netlify entry `assets/index-D5D780XZ.js`, embedded application source `5e2105e3…` |
| API / private custody | Fly releases 36 / 5; image `sha256:dc31db72e53ec6cf9b0f445da1d5acd7c3e4f91545a06668cab41bbf0483f942` |
| Signaling / encoder | Existing deployments retained |

The [exact-candidate signer-free validation](https://github.com/knzeng-e/dotify/actions/runs/40895291181)
passes. Local Host-profile checks pass against the live Remote Config; 25
environment tests and the clean frozen Product build pass. The merged PR's
full CI, including publication and three-engine browser coverage, passed.

Independent readback at finalized Asset Hub block **15065272** confirms the
root/app contenthash and executable version. Public retrieval returns HTTP 200:
12,801,649 CAR bytes, SHA-256
`f7775245b286a2350da38c03997c5c3f956d73ac76a959e32ad618df32760b31`.
All **127** blocks verify. The logical directory root matches local
merkleization; index and entry bytes match the signed build. The local DotNS
signer was removed after publication. Storage used an independently checked
authorized DevNet pool account, not the DotNS owner.

## Service and state checks

There were no active preparation jobs before the custody update (four ready,
one failed). Custody recovery snapshot `vs_njKLD0KjJoL5cz4lkZ8RY` was created before
replacement, with 14-day retention. The single private writer was updated first; its readiness
and commit identity passed before the two public API replicas rolled.

Public `/health/ready` returns 200/ready; `/version` identifies `5e2105e3…`.
The catalog remains fresh with one registered release, no index error and a
two-block lag at the check. No catalog reset, contract/CDM redeployment,
database identity change, secret rotation or infrastructure purchase occurred.
The permanent nonce ledger, encrypted preparations and shared security state
remain in their existing stores.

## Acceptance and rollback

Reopen Product and verify **You → About Dotify → 0.1.67**. Retry a failed
preparation through the artist UI; verify that a failure stays visible, that
retry uses the current account/draft, and that a completed release returns to
the release list. A real Web/Product publication remains an owner acceptance
check; integrity/readiness checks do not establish that signature journey.

Compatible rollback: Product 0.1.66 and the preceding API/custody image
`sha256:a891a042337d75f14c23f0bd46a5974b0f4fc927c642f3e7c1e37970e20344e9`,
retaining current PostgreSQL, volume, keys and nonce reservations. This patch
does not change durable job formats. Do not restore an older state backup over
newer security writes. Bulletin audio storage is not activated by this release.
