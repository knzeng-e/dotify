# Product 0.1.66: fresh bounded-runtime deployment

Status: candidate prepared; service/client publication pending. Refs #293.

Application source: merged #348, `1cc164cc3af6e46f19d95632bf37c5bb77c07535`.
Includes the room presentation changes and 3D retirement from #347.
This is the owner-authorized internal catalog reset, not a migration of existing artists.
Artists must create a new space and publish again after cutover.

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
The guarded operator update changes only the directory field in namespace
`dotify`. Application roles, session epoch, nonces, revocations, quotas,
encryption reservations and receipts remain unchanged. Old contracts and pins
are retained; no old-runtime fallback is introduced.

A rollback must restore the matching directory identity, service configuration,
CDM snapshot and client generation together. Do not restore a pre-W36 local
state service or roll back the shared database over newer security writes.
After any new publications, assess their state before rollback.

## Acceptance boundary

Live service readiness, served Web SHA, finalized DotNS CID and Product
version will be recorded after publication. New artist registration,
publication, Free/paid listening and tips on physical Product mobile/desktop
remain user acceptance checks; automated tests do not establish audible playback.
