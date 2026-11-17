# One real-runtime Bulletin publication: preparation

Refs #288 (W33), #287. Prepared from tested dev `a463d6be174237d2ce1f652acaddccf1eb9c0273`
after #372. This record is **not a deployment, write allowance, published release
or physical protected-playback acceptance**.

## Candidate and bounds

The private publisher gains an optional `pilotScope`: one exact
chain/runtime/content/key-version identity and one durable publication job.
It rejects a different identity or new job before a write session; the original
job retains bounded reconciliation/retry. No automatic renewal, provider retry
or broader artist migration is enabled. Profile bindings include the restriction;
removing it requires a reviewed new generation, never erasing used state.

The candidate includes Product `[0,1,68]`, the merged Web/Host readers and private
writer, with no new Host permission, contract or paid service. Private custody
keeps the existing 1 GiB machine and encrypted `/data/contributions` volume.
Its prepared health-check grace becomes 60s for the bounded 30s network preflight.
The source remains Pinata by default until explicit configuration activation.

Proposed pilot paths on that existing volume:

- profile: `/data/contributions/config/bulletin-pilot.json`;
- fresh queue: `/data/contributions/streaming-bulletin-pilot`;
- separate inventory: `/data/contributions/bulletin-pilot-publications`;
- binary signer: `/data/contributions/private-storage-key/storage.seed`.

No path or secret has been provisioned remotely. The owner selected reuse of
DotNS account `5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca` for the candidate;
installing its binary mini-secret in private custody conveys the same account
authority. The exact reviewed deployment approval must cover that transfer.
The encoder and public API never receive it. Do not run another writer with
this account during the pilot. Preserve existing local canary state separately.

## Public synthetic source and proposed identity

The existing deterministic `generatedWav(8)` chord produces 256,044 WAV bytes,
SHA-256 `9049f781cb98e534bea2d112d2fe94a81b8302a53792bd4c96c68df6a90b93ac`.
No artist music is used. Proposed scope:

```json
{
  "chainId": 420420417,
  "runtimeAddress": "0x05c643a1ed0e75c8a3486410f13bc4597c2674d7",
  "contentHash": "0x66aae2bdd5859205f46c62291d93d6d5618e56201a507c2b9f5277823edafd35",
  "keyVersion": "dotify-content-key-v2"
}
```

A read-only Asset Hub check at finalized block **15189032**,
`0xd5918ace50e48b59a794229ed55f75013b953ce51044d5a00b0fc8f7367722d7`,
confirms this runtime in the configured artist directory, with owner
`0x2f6BF01a6708C927b288a53B9fE3f9edc689FF56` and nonempty code.
That proves registration/ownership, not availability of its wallet signer.
The ordinary artist UI must verify that connected account before publication.
The alternative browser artist runtime was also confirmed but is not admitted
by this proposed profile.

For sizing, the actual transcoder ran in local Docker image
`dotify-w32-codec-tests:local` (`34076bf1e8ee`), FFmpeg **5.1.9-0+deb12u1**,
without network, credentials or writable host mounts. The generated-only
result has 96/160/320 kbit/s renditions, two segments each, duration 8s.
Local encryption under a throwaway random content key produces **16 blocks /
713,259 bytes**. That key was discarded. This is sizing evidence, not production
ciphertext: live custody must derive its own key from the actual runtime scope
and preserve its permanent nonce generation. Its root is not predetermined.

Proposed hard allowance: **one job, at most 16 attempted stores / 1 MiB**,
concurrency 2, at most 512 KiB in flight. A larger graph fails before submitting;
a failed attempted submission stays charged. Keep 16 additional renewal slots
and the actual graph bytes reserved, without sending renewals. Old obligations
remain **107 slots / 21,684,749 renewable bytes**. The last read-only operator
check at Bulletin head **1458898**, nonce **1046**, finds zero pending stores.
It reports 34 transactions after subtracting the earlier 91-slot floor:
**125 raw slots**, only 18 after the current 107-slot floor. At least 139 raw
slots are required for 16 new stores plus all renewal floors: **14 are missing**.
Recheck raw on-chain counters and expiry immediately before activation. Quota
is not permission to spend it; deployment and the 16-store allowance remain separate.

## Deployment and acceptance sequence

1. Review/merge this bound and obtain green CI. Prepare clean Web/Product/API
   artifacts with matching commit identities. Verify the live Host profile.
2. Review the exact activation: private account file, fresh persistent queue and
   inventories, one scope/job, writer budget and adequate quota. Snapshot coherent
   existing state before replacement; do not overwrite permanent nonce ledgers.
3. On custody only, set `STREAMING_AUDIO_STORAGE=bulletin`, the explicit profile
   and fresh queue path. On read-serving edges, set the read-only pinned
   `BULLETIN_MEDIA_RPC_URL`. No signer on edges. Roll custody then the two edges;
   verify readiness and identities before Web/Product publication.
4. Through the ordinary Host artist flow, use the generated WAV and clearly
   label the release as a synthetic protected test. Keep the separate optional
   Bulletin metadata archive toggle off. Cover and metadata still use Pinata:
   review those uploads too; no artist master goes there through this audio path.
5. Register Classic access through the artist wallet, not an operator bypass.
   Record the finalized runtime track, exact audio reference, canonical catalog
   release and all sender/nonce/retention receipts. A ready storage job alone is
   not a registered release. Payments, if used to grant a second account access,
   require their own explicit user wallet confirmation.
6. Verify denial for a distinct unentitled account, then authorized Web/Desktop/
   physical mobile listening through the existing signed-key flow. Record
   cancellation, retry and network/background recovery separately; no key in
   reports. Distinguish cached `playing` events from measured audible cold start.

Roll back with the old Pinata selector **and its old queue**, preserving all
pilot receipts, ciphertext, profile bindings and nonces. Once a Bulletin release
exists, its read path/key custody/retention are still required. A same-volume
snapshot is not disaster recovery; off-volume restoration remains a public-use
gate. No broad rollout or W33 closure follows automatically from this one test.

## Validation

The publisher regression rejects all four altered scope fields before opening
any write session, publishes through a simulated finalized transport, restarts,
refuses a second job and retries the original without a duplicate store.
Removing the pilot field fails the immutable profile binding. Existing API
access-denial, queue recovery and transport tests remain applicable. Live runtime
reads and local Docker sizing above submit no transactions. CI/build results
are recorded with the candidate PR; physical protected listening remains pending.
