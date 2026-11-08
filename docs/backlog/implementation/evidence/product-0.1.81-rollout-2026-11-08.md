# Fresh development publication active — 2026-11-08

**Web, Product, API and custody 0.1.81 are delivered** from frozen source
`1394503f1a8c700a103df01a2510a75b66970623`, based on merged/tested dev
`6fc81748e860a15e79c30d5c69fd53eae1cd1112`. This activates merged #409–#411
under the owner's bounded development allowance. Refs #407; actual fresh artist
publication, wallet registration, catalogue and audible client acceptance remain
open. [Structured evidence](product-0.1.81-rollout-2026-11-08.json) preserves
public receipts, finality, deployment and remaining gates without secret values.

[Exact-source CI](https://github.com/knzeng-e/dotify/actions/runs/42481430030) and
[merged-dev CI](https://github.com/knzeng-e/dotify/actions/runs/42480764278) pass.
The frozen release changes only appVersion `[0,1,81]` relative to merged dev.

## Artist-visible result and boundaries

The old synthetic-only admission is replaced by **two complete new releases
globally across the two reviewed owner/runtime pairs**. Artists use ordinary New
release with audio, cover, details and explicit wallet registration; no per-file
operator exception is needed inside that allowance. They must begin a fresh
release, not retry an abandoned v2 draft. Existing catalogue references stay.

[ADR 0046](../../../adr/0046-bounded-multi-release-admission.md) reserves one
complete audio/cover/metadata allowance per admitted release, durably and without
automatic refunds for abandoned work. Per release: audio at most 320 stores /
64 MiB, cover 32 / 8 MiB, metadata four / 64 KiB. Total musical allowance:
**712 attempted stores / 151,126,016 bytes**, at most two releases. Existing
artist authority, signed upload grants, metadata/reference isolation, wallet
approval and canonical listening-access checks remain authoritative.

Read-only sizing of the previously prepared 17.05-MB and 4.68-MB source cases
found approximately 24.28 MB / 18.71 MB of encrypted payload plus manifest, with
data-block lower bounds 145 / 169 before directory/file-node overhead. These
measurements justify headroom for representative tracks, not a promise that
every file accepted by the upload-size limit fits the publication allowance.

## New key domain and shared key serving

Following the owner's development decision, [ADR 0047](../../../adr/0047-fresh-bulletin-development.md)
starts a new random v3 content master and empty encryption/admission journals.
It does not migrate, repair, relabel, import or delete the old drafts/history.
The same Bulletin account keeps its duties; the new finalized nonce floor is
**1290** after application delivery. After first use these new journals are
permanent and must not be recreated as a recovery shortcut.

Custody encrypts publications; the edge API verifies access and derives listening
keys. **Both roles require the same content-version map.** The original private
dossier incorrectly described key serving as proxied to custody. Source inspection
of `app.ts` and `sharedState/custodyProxy.ts` caught this before activation; the
owner explicitly approved the corrected API installation. No public code change
or additional write budget was needed. The new mapping reached both Fly apps
through private process memory/stdin, without key values in argv, logs, Git or a
local operator file. Existing v2 compatibility secrets stayed unchanged.

Independent runtime checks verify identical v3 master binding on custody and
both key-serving replicas, active v3 with retained v2, and HTTP 200 health and
readiness. Initial activation has zero new jobs/admission claims; no musical file
was sent by the operator. A real new-domain recording is not yet audible evidence.
Old-v2 derivation remains byte-identical in the internal before/after check;
physical retained-release listening remains a user acceptance check.

## Application delivery and capacity

Application writes: **12 stores / 3,587,875 bytes**, **eight immediate renewals /
5,899,777 bytes**, **20 distinct CIDs / 9,487,652 accounted bytes**. Nonces are
1270–1289; exactly two DotNS signing requests use Asset Hub nonces 486/487.
Each operation is journaled before signing, bound to exact call/genesis/nonce and
charged once. No uncertain response is automatically resubmitted.

Offline verification authenticates 99 unique CAR blocks and 71 files. Independent
finalized readback retrieves/byte-compares all 20 outer objects, checks canonical
position/expiry and both DotNS contenthash/manifest records. Every renewal
extends retention. Earliest application dependency expiry is **1760767**; account
authorization separately expires at **1621405**. The independent lab stays 0.3.1.

CAR SHA-256: `ea90beb2758e2b05486817283401d4adb209d117f942b0fd4f487159dac0eb98`.
Storage root: `bafybeiftek3c32m2ro6mf6xcrazdlyeccgrc3rvelbdzr6ngijfnhg7wb4`.
Netlify's served entry `index-B-Iyg9iH.js` is 1,149,931 bytes, SHA-256
`4803a0ffce5ca49bfd5d3181f70699af7da08adcdb7db95e04d78468873f8e10`.
Exact reconstruction matches its existing clean=false build metadata and public
configuration digest; application source is unchanged. Published mobile-size
boot has no uncaught error, wallet, upload or key request.

After application delivery: **3,091 available transactions**, 556,399,916 store
bytes and 610,134,273 renewal bytes. The owner's quota tool added allowance;
the resulting total was 3,510 with 399 previously used, not a reset of spending.
Extra available quota grants no extra publication authority. Preserve prior
431 renewals / 150,484,205 bytes, then all app dependencies: **451 /
159,971,857**. Reserving the full two-release maximum gives a conservative
future ceiling of **1,163 / 311,097,873**. No scheduler or automatic renewal is
activated; the reviewed combined app/music ceiling remains 732 operations /
160,613,668 bytes and two DotNS requests.

## Maintenance, recovery and remaining acceptance

The existing two edge machines and single custody machine use immutable image
`registry.fly.io/dotify-api@sha256:c515d84b820eb23671b246163b2e1021ca9efeb71770c4bba93bc58576dc7f47`.
Linux/amd64, source label and UID 1000 are verified locally; isolated final-image
rehearsal refuses wrong active versions/existing destinations and creates private
mode 0600 key files without a signer or network.

Custody's writer was stopped before initialization. The saved complete Machine
configuration, same volume and existing signing seed were preserved. Fly CLI
retained an old HTTP check even when omitted/emptied in its input; the guard
refused initialization before key creation. Applying the complete reviewed
configuration through the Machines API removed it, with no writer running.
The original serving checks/settings were restored afterwards. Both edge replicas
loaded the key map before the fresh custody writer was enabled.

Completed volume snapshots exist before initialization and with the new domain;
the new master also resides in Fly's encrypted secret stores. This is not a
tested off-volume restore or proof of complete historical conservation. Rollback
may disable new writes or restore compatible code but must preserve v3 master,
admission/encryption journals, account cursor and receipts. No new service,
signaling/encoder deployment, wallet/signing-seed transfer or purchase occurred.
The local signer was cleared immediately after capture and verified absent.

The owner is asked to publish one new selected track through the ordinary journey
and report registration/catalogue plus audible playback. Keep #407 open until
that real acceptance, including the Web/Desktop publishing target, is recorded.
Then continue #395 measured Room startup, #388 artwork and separate #406/#408
CASH research. Signed denial/interruption, account changes, conservation and
coherent off-volume recovery remain W33 public-pilot gates.
