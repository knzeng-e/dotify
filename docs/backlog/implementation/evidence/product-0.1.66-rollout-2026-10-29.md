# Product 0.1.66: fresh bounded-runtime deployment

Status: deployed on 2026-10-29 (Europe/Paris). Physical-device acceptance remains open. Refs #293.

Application source: merged #348, `1cc164cc3af6e46f19d95632bf37c5bb77c07535`.
Includes the room presentation changes and 3D retirement from #347.
This is the owner-authorized internal catalog reset, not a migration of existing artists.
Artists must create a new space and publish again after cutover.

## Published identities and verification

| Surface | Verified identity |
| --- | --- |
| Product / Web packaging | `777be5940fc94c741bb0ca5737277be41f7d23f3` |
| Product version/profile | `[0,1,66]`, product-cdm/devnet; unchanged permissions, empty bootstrap |
| Root/app transport CID | `bafybeigrozkluvbcngpgqnsetv4ksgma6qjcx6q3o5rgyrmceer6742puq` |
| API / custody | Fly releases 35 / 4, image `sha256:a891a042337d75f14c23f0bd46a5974b0f4fc927c642f3e7c1e37970e20344e9` |
| Signaling | Fly release 38, image `sha256:c3cf987ba8c4d03dccc11235fe3aaa3bafa0b7523832687543d1960bb668b80c` |
| Private encoder | Existing deployment retained; no encoder change in this release |

Merged-source CI [40791818905](https://github.com/knzeng-e/dotify/actions/runs/40791818905),
packaging CI [40794103019](https://github.com/knzeng-e/dotify/actions/runs/40794103019),
and signer-free release validation [40793809360](https://github.com/knzeng-e/dotify/actions/runs/40793809360)
pass. The live Host configuration matches CLI 0.20.0 and the tracked profile.

Independent DotNS readback at finalized block **15041090** confirms both root
and executable contenthash, plus executable version `[0,1,66]`. The public CAR
returns HTTP 200: **12,799,907 bytes**, SHA-256
`06054dec158cf9ce533343c22a1e4100ce128bb6d183000375e55f100b329244`.
All **127** blocks verify; the inner directory root matches local merkleization;
index and entry bytes match the clean build. No 3D scene/Three.js chunks remain.
The local DotNS signer was removed after successful publication.

Netlify serves `assets/index-VEVSbNaz.js`, embedded SHA `777be594…`, entry
SHA-256 `2720b0325c306c19e07d9af94235f68bea8598f4cb02583dd4107009a4daba1e`.
The loaded module graph contains the new factory and directory addresses.

Two public API replicas, one private custody and signaling are started. API and
custody readiness return 200, catalog indexing reports `empty`, zero artists and
no error, and `/version` identifies application source `1cc164cc…`. The existing
edge-only Pinata diagnostic remains degraded because credentials intentionally
live in custody; custody independently reports Pinata configured and ready.
Exact Web/Product CORS origins pass; an untrusted origin is not allowed.
A temporary signaling room was created and joined by a guest, then cleaned up.
This smoke does not establish native audio output.

## Contract evidence

- Chain 420420417; factory `0x61dd19a0d4f6bd21c6ffa4a7a9d9e771af95bb13`;
  directory `0x79b21cad3848a3019edee17b089142282f4a13a3`.
- Finalized owner-guard audit at block 15040310,
  hash `0xc392855f9388a607a139d12ac489e04a03a4bd773a003173cf609de7a3f39f7b`:
  pairing/source bytecode match, zero registered/pending runtimes.
- Explorer source verification passes for the deployed core contracts.
- Both CDM packages are version 3, independently read at finalized block
  15040535, hash `0x438e7b207d3de798f6ff3934d0f7b4a291491b7ca721d0cf1b5640d925c98741`.
  Metadata blobs were stored with finalized Bulletin transactions before registration.
- Directory CDM transaction: `0xb269d0c3c5f366622df7fae31f4a671debcf26d54c5ff5061742051e0062cace`.
  Factory CDM transaction: `0x48d071e7f2172218eb4cd5e6085f247e9a5590561d51b0e161eef6d7e47023b2`.

## State and rollback

Managed PostgreSQL full backup `20261029-001600F` completed before cutover.
Custody snapshot `vs_32kX1Zk2VpXysDXM4Y0kl` is available with 14-day retention.
The guarded operator transaction committed successfully, changing only the directory field in namespace
`dotify`. Application roles, session epoch, nonces, revocations, quotas,
encryption reservations and receipts remain unchanged. Old contracts and pins
are retained; no old-runtime fallback is introduced.

A rollback must restore the matching directory identity, service configuration,
CDM snapshot and client generation together. Do not restore a pre-W36 local
state service or roll back the shared database over newer security writes.
After any new publications, assess their state before rollback.

## Acceptance boundary

New artist registration, publication, Free/paid listening and tips on physical
Product mobile/desktop remain user acceptance checks. Automated tests do not
establish audible playback or a refreshed installed Host cache. Reopen Dotify
and check **You → About Dotify → 0.1.66** before those checks. The empty catalog
is intentional; recreate an artist space and publish a new release.
