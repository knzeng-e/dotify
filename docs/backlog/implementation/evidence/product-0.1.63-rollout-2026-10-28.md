# Product 0.1.63 and shared API activation

Refs #291, #158 and #317. The owner authorized the complete W36 topology and
its estimated additional infrastructure budget, then explicitly approved Fly's
managed-writer role with namespace row policies. This is a deployment record,
not physical-device or pilot acceptance.

## Released identities

Tested merged dev: `200d6195a99b8565cd572cc55a696d479985023f` (#340).
Final clean packaging/API correction SHA:
`5de94989f2e36e6ee8e9e871471233e07d9381f1` (#341). This includes the version
bump and the IPv6 correction discovered during activation. The signing
checkout remains detached at that SHA; later evidence commits are not the
published executable.

| Surface                | Observed identity                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Product                | `[0,1,63]`, `product-cdm` / `devnet`; existing SDK, permissions, account index and CDM retained                                  |
| Root and app DotNS CID | `bafybeigxlqyghdtxrxvyce6e5axi3milqscwx2vvvgmfnh5ktuyp5juyy4`                                                                    |
| API                    | Release **34**, same final SHA, two warm 1 GiB shared-CPU machines in `ams`: `801939c6315568`, `890e31c60749e8`; no volumes      |
| Private custody        | Release **3**, machine `e82d13d0c61238`, `ams`; volume `vol_40o3jqwp33p5z6m4`; no public IP or HTTP service                      |
| API/custody image      | `registry.fly.io/dotify-api@sha256:c8306b542fe4aa8d6979d05063d7aa79f65fcb84b54a146053fb4687cceefe5c`                             |
| Database               | Fly MPG Basic, cluster `ey5qn0yxwmdr8zmw` / `dotify-state-ams`, PostgreSQL **16.15**, 10 GiB, `ams`; database/namespace `dotify` |
| Web                    | Netlify deploy `6ae0f2f053000f121e22fc26`; embedded source SHA `200d6195a99b8565cd572cc55a696d479985023f`                        |

The Web entry is `assets/index-FJ7oq6Er.js`, SHA-256
`1d1f2a9640a14d06cbbbc47035a0874ced5e0ff7a770d0e012b9999fd9d7c88a`,
config digest `0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9`.
Its embedded `buildClean=false` remains explicit: this is not controlled
first-sound evidence. The later packaging correction changes server ingress
and deployment metadata, not the Web application behavior.

## Migration and security boundaries

The old API was quiesced at **2026-10-27T22:38:57Z**. Its complete source volume
`vol_42kj9wq1q97njm14` remains detached and untouched. Nine files and six source
directories, including empty streaming directories, were transferred. SHA-256
checks and UID/GID 1000 were verified. After activation and a custody restart,
all nine file hashes still match, including every permanent encryption nonce
reservation and the receipt ledger. No streaming initialization, contract
reset, content-key rotation or artist-runtime upgrade was performed.

The new namespace imports the catalog and every still-live revocation with
the original session epoch. Both current releases and artists are retained.
An independent `SESSION_SECRET` now signs sessions; a distinct transport token
protects edge-to-custody requests. Existing content-key version material and
the encoder/native-receipt credentials are preserved. Pinata and encoder
authority reside in custody, not public API replicas or the frontend.

The old in-memory upload usage could not be exported. Rather than reopening
an empty budget, the import transaction conservatively charges the entire
verified old global limit, **2 GiB**, until one full old quota window expires.
This is quota metadata, not a payment or signer. New publication is closed
until **2026-10-27T23:40:05Z**, or **00:40 on October 28 in Paris**; existing
listening/key access is independent. Usage expires normally; no manual purge
or deletion of permanent encryption reservations is permitted.

Fly MPG rejects custom table grants to its managed roles. The approved
alternative is the managed writer role plus the operator-only
[`002-managed-runtime-policies.sql`](../../../../services/api/migrations/002-managed-runtime-policies.sql).
The runtime cannot administer the schema, bypass row policies, truncate the
state tables or change the deployment identity. The other three state tables
are restricted to namespace `dotify`. This is a dedicated Dotify cluster;
future application tables require explicit policies before using this role.
Direct connections use verified TLS, avoiding transaction-pooled advisory locks.

Previous-session authentication ends at **2026-10-28T21:37:47Z**. Retain the
expired previous-secret deadline for delayed logout until all old families
expire, conservatively **2026-10-28T22:39:00Z**, then remove both previous-secret
fields together. The old content master itself remains required for audio;
do not rotate or remove content-key material as session cleanup.

## Observed verification

| Check                          | Result and limit                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API regression/typecheck/build | 229 tests pass, including one real listener serving IPv4 and IPv6                                                                                                                           |
| W36 PostgreSQL suite           | 14 local scenarios pass: replay, quotas, renewal/revocation, election, outages, restore and process replacement                                                                             |
| Managed-role protection        | 14 checks pass with the real runtime login in an isolated database; identity writes, namespace escape, schema changes and truncation denied                                                 |
| Live two-edge sessions         | One concurrent nonce exchange succeeds; both accept/renew the session; parent logout rejects renewed credentials on both; restarting an edge preserves the session                          |
| Public access                  | Fresh catalog with two releases; actual Free key allowed, malformed/invalid-session preparation rejected, key replies `no-store`; encrypted manifest HTTP 200 / 17,035 bytes                |
| Edge-to-custody                | Missing-session upload returns 401; a valid synthetic session reaches schema validation (400); preserved receipt history returns 200 / `no-store`                                           |
| Controlled custody outage      | With no active jobs and publication held closed, publishing returns actionable 503 while readiness and existing Free-key delivery remain available; custody restarts with the same volume   |
| Backup/restore                 | All four application-state tables dumped/restored using PostgreSQL 16 in a separate database; provider extensions excluded; post-migration managed full backup `20261027-230305F` completed |
| Volume backups                 | Scheduled snapshots enabled, 14-day retention; original detached source retained independently                                                                                              |
| Deployed-source quality gates  | All 12 jobs pass at `5de94989`, [40598783654](https://github.com/knzeng-e/dotify/actions/runs/40598783654), including the three-engine streaming and core-flow suites                       |
| Product exact-SHA CI           | [40598687311](https://github.com/knzeng-e/dotify/actions/runs/40598687311) passes without signing authority                                                                                 |

Synthetic signing tests use an ephemeral identity only. No artist purchase,
tip, upload or user-wallet approval was performed by the smoke scripts; keys,
tokens, signatures and receipt-history payloads were not logged or persisted.
Physical signing, audible background continuity and real artist publication
after the hold remain owner/device checks. A live full-database outage was not
injected; the fail-closed database scenarios are local/CI evidence.

The edge dependency report still calls missing local Pinata credentials
`degraded`, while `/health/ready` returns 200 / `ready=true`. This diagnostic
is not role-aware. Custody is separately ready and real proxy calls pass;
do not copy Pinata authority back to public edges to silence this warning.

## Product readback and operational corrections

The first publish attempt used public Bulletin pool account 0, whose storage
authorization had expired. It failed before a DotNS update; finalized readback
confirmed the previous 0.1.62 CID/version unchanged. A signer-free query found
pool account 1 authorized with sufficient quota. The signer was reactivated
locally, account 1 stored the bundle, and the owner signed DotNS. The local
signer was removed and its absence independently confirmed.

At **2026-10-27T23:06:06Z**, finalized block **14997009** confirmed the same
new CID on root and app, with exact manifest
`{"$v":1,"kind":"app","appVersion":[0,1,63]}`.

- Root transaction: `0xb46c6883d3d1d90f4201f8f3794e55f7dd9b0401c09abffea3f3b76e88abb844`.
- Atomic app contenthash/executable transaction: `0xef4c7223689dc6470b30a8b0153d0ddb4ea079618272a1fc04b89be4ae9b42e2`.
- All 18 transport chunks reached finality. Public CAR: **13,564,606 bytes**,
  all **136** block hashes verified; SHA-256
  `b041b106c5dbe849c64b9eb9f02acc6ee16e905b6ddf2cdb5d477f0cad37ecd0`.
- Public index, entry and both lazy graphics chunks match local bytes exactly.
  Entry `assets/index-BmBOuFY7.js`, SHA-256
  `c0d05f6c8e2cdca70247492c3be00e1c54b239317329a1facdb9238cd38d2960`.
- Inner UnixFS root `bafybeiagtepeifimghvlkwqzijcyo6ci5vn62ky435vt23xeaiuzslhtre`
  matches local merkleization; it differs intentionally from the transport CID.

Two transfer/deployment defects were caught before calling custody ready:
SFTP omitted empty directories, which were restored from the quiesced source
inventory, and the old IPv4-only listener refused Fly private IPv6 requests.
The new listener was verified over IPv4, IPv6 and the actual `.internal` origin.
The old API was offline during final import; public service resumed before
the IPv6 correction. Publication remained closed by the conservative quota hold.
Signaling and the encoder were not redeployed or restarted.

For rollback, withdraw clients to Product 0.1.62 if needed but retain the
compatible shared-state API image above, the current database, signing overlap
and the one custody volume. API release 32/local-state images are unsafe after
shared writes. Artifact verification is not installed-Host or pilot acceptance.
