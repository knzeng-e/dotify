# Product 0.1.68: one protected Bulletin publication pilot

Deployment record for 2026-11-01. Refs #288 (W33) and #287; neither the general
media delivery gate nor protected physical-device acceptance is closed.
Application source is merged #373, `a74c5242d2fc983b2bd64c3585aea24659516bea`.
The [exact-source dev CI](https://github.com/knzeng-e/dotify/actions/runs/41314728872)
is green. This record adds no application code. The [public verification summary](product-0.1.68-rollout-2026-11-01.json)
keeps exact identities, block counts and service checks without credentials.

## Delivery identities

| Surface | Verified identity |
| --- | --- |
| Product | `[0,1,68]`, existing product-cdm/devnet Host profile |
| Root/app transport CID | `bafybeigmmzrwr25ybm3cf3kko5hbgd62rbxq72pjgwv4rgoaafpijh63va` |
| Web | Netlify embeds `a74c5242…`; entry `assets/index-ggOIomjk.js` |
| Server image | `registry.fly.io/dotify-api@sha256:9355fecf3673f91557b501bb3aba901a5a2b4412a2a0ea5d5ece953be30d81a4` |
| Signaling / encoder / contracts | Existing deployments retained |

Both DotNS records were read back at finalized Asset Hub block **15191958**.
The root branding, owner/resolver and lab 0.3.1 records remain unchanged.
Independent retrieval authenticates all **18 outer blocks**, reconstructs the
**12,857,032-byte** CAR and compares its SHA-256 with the reviewed build:
`1fbc4d68df8d5782539481e850e16c8a84956d36a2b262538ee05cfa0756a96f`.
The public gateway returns HTTP 200 with those exact bytes. Offline checks
verified 137 inner CAR blocks and compared all 98 distributed files.

Product publication used **11 new stores / 7,831,827 bytes**, reused seven
retained blocks and used exactly two DotNS signing requests. It stayed within
the approved 18-store / 12,893,788-byte Product cap. The raw transaction quota
fell from 325 to 314. No renewals were sent. The earliest retained Product
block expiry observed was **1477259**, at Bulletin head **1459868**: recheck
retained dependencies before later tests, rather than assuming permanence.
The local launchctl signer was removed immediately after capture and its
absence was verified after publication.

Netlify source identity is verified, not a claim that its independently built
entry bytes equal the local Web build: two shared entry modules match, while
its main entry has different build configuration/metadata. Product integrity
is separately established by the exact CAR comparison above.

## Private activation and state

`dotify-custody` is an existing centrally operated server on Fly’s internal
network. It owns publication state and key custody; edges authenticate calls
to it. Chain storage does not eliminate this server trust or make the complete
publication/access path decentralized.

The existing private custody service first received the new image with its old
Pinata selector and queue. All readiness checks passed. The old queue contained
four ready and one failed job, with no active preparation. Snapshot
`vs_YY5Axb5YR6AaTjXkYopA` was created before installing the key, retaining the
existing volume and permanent nonce history. No catalog reset, SQL identity
change, new service, paid plan, contract or region was introduced.

The owner explicitly approved installing the 32-byte binary mini-secret of
`5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca` in private custody.
It has the same DotNS account authority; it is not a storage-only cryptographic
restriction. The reviewed stdin transfer keeps mnemonic text out of the image,
arguments, frontend, encoder and edges. The key is owned UID 1000, mode 0600,
inside a 0700 directory on the encrypted persistent volume. Future whole-volume
snapshots can contain it. Inventory-only backups must exclude it; key recovery
and off-volume restoration remain separate responsibilities.

Active custody configuration:

```dotenv
STREAMING_AUDIO_STORAGE=bulletin
BULLETIN_PUBLICATION_PROFILE=/data/contributions/config/bulletin-pilot.json
STREAMING_STATE_PATH=/data/contributions/streaming-bulletin-pilot
```

The fresh inventory is `/data/contributions/bulletin-pilot-publications`.
Startup confirmed readiness, a live exclusive publisher lock and zero admitted
jobs. The read-serving edges use only
`BULLETIN_MEDIA_RPC_URL=https://bulletin-paseo.tservices.es:8443`, without the
profile or storage signer. The single writer and two warm public replicas are
preserved. The public API returns the expected commit and HTTP 200 / `ready: true`;
a CID outside the catalog returns 404, and Web preflight permits the exact Netlify
origin. The edge readiness label remains `degraded` because its generic Pinata
check expects a credential deliberately held only by custody. All private checks
pass; a role-aware diagnostic is a follow-up, not a reason to copy credentials
to edges. Covers and metadata still use the existing private Pinata setup.

The immutable profile admits **one durable job** for the exact scope below,
with **16 attempted stores / 1 MiB** across its retries. Other publications are
refused during this pilot. The profile carries a conservative prior renewal
floor of **125 slots / 34,578,537 bytes**, including the complete Product graph.
The audio graph needs its own additional renewal floor. Reserved counters are
admission checks, not scheduled renewals.

```json
{
  "chainId": 420420417,
  "runtimeAddress": "0x05c643a1ed0e75c8a3486410f13bc4597c2674d7",
  "contentHash": "0x66aae2bdd5859205f46c62291d93d6d5618e56201a507c2b9f5277823edafd35",
  "keyVersion": "dotify-content-key-v2"
}
```

## Next owner acceptance

1. In Host Desktop, confirm **You → About Dotify → Product 0.1.68** and use the
   existing artist account ending `89FF56` for the admitted runtime. The other
   browser artist runtime is outside this profile.
2. Publish the unchanged eight-second `generatedWav(8)` file from the prepared
   package, clearly named as a synthetic protected test. Its WAV SHA-256 is
   `9049f781cb98e534bea2d112d2fe94a81b8302a53792bd4c96c68df6a90b93ac`.
   Select Classic access; keep the optional Bulletin metadata archive off.
   At most two small cover/metadata Pinata uploads, together at most 512 KiB,
   are approved. No artist music is admitted.
3. Complete the normal artist wallet approvals. Preserve a failed job and use
   its retry/reconciliation path; creating another job does not replenish the
   allowance. Verify finalized registration and the canonical audio reference:
   a ready preparation alone is not a published release.
4. Check a distinct unentitled account is refused the key, then verify entitled
   Web, Host Desktop and physical mobile listening, cancellation/retry and
   network/background recovery. Any purchase remains an explicit user wallet
   action. Do not put content keys in reports.

The rollout itself sends **no audio stores**. Protected publication and listening
are not yet accepted. Earlier uninterrupted synthetic lab listens do not prove
this real-runtime access path, cold audible startup, representative release
throughput, cost, disaster recovery or recurring retention.

## Rollback

Stop and await custody, preserve the Bulletin queue, inventories, profile
bindings and permanent nonce ledger, then restore the old Pinata selector
**and** `/data/contributions/streaming`. Keep the new image when retaining any
Bulletin release: it still needs the read path, key service and retention.
Never restore an older snapshot over newer security writes or erase histories
to retry. Once the first job is admitted, changing scope or replenishing its
budget requires a separately reviewed fresh generation carrying all existing
obligations. See the [publication runbook](../../../operations/bulletin-artist-publication.md).
