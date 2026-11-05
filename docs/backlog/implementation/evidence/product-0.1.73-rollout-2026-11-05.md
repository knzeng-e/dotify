# Protected account lifetime rollout — 2026-11-05

Refs W33/#288. **Web and Product 0.1.73 are published and independently verified**
from `560e7332f2fabe7b849ba829fb0543688a7447b1`, frozen branch `release/product-0.1.73`, based on merged
#386 / dev `71c9736f`. [Exact-source CI](https://github.com/knzeng-e/dotify/actions/runs/41945194955) passed on its first attempt.
[Structured receipts](product-0.1.73-rollout-2026-11-05.json) preserve the public artifact, submission and
readback evidence. The owner confirms disconnect stops the sound and explicit
recovery works on Web, Polkadot app Desktop and mobile. Signed denial, account
switching and room-guest silence on host disconnect remain open.

## Behavior and authority

The [account-lifetime correction](bulletin-protected-account-lifetime-2026-11-05.md)
retires attached and pending account-bound protected audio when the account or
network identity changes. It aborts the old producer, clears its owned decoded
sources and requires an explicit normal access recheck after reconnect. Late
responses cannot reopen the retired selection. Free listening and profile-only
changes retain their source. Existing server authorization remains authoritative;
this client lifecycle correction does not revoke a key already delivered to a
listener or claim DRM against a modified client.

The existing registered `Dotify-Bulletin-pilot-8s` by **Thot Nzeng** remains the
acceptance target, at block **15,321,680**, encrypted Classic access **1.42 PAS**.
Runtime `0x05c643a1ed0e75c8a3486410f13bc4597c2674d7`, content hash
`0x66aae2bdd5859205f46c62291d93d6d5618e56201a507c2b9f5277823edafd35`.
The catalog's two entries, media references and public ciphertext are unchanged.
No new music publication or payment is needed for artist replay/interruption.

## Product artifact and publication

Publication completed at **2026-11-05T01:32:48.220Z** with **12 stores / 3,557,988 bytes**,
**eight reuses** and **two DotNS signing requests**. Finalized nonces are
**1150–1161**; no uncertain submission remains.
Root/app resolve to `bafybeihwap3ymedmpxkcyqhadyicu3ixkdmzzkv47mrq63yhqz32xpe2cm`, executable `[0,1,73]`. Branding,
owner/resolver and separate 0.3.1 lab records are unchanged.

The **9,413,829-byte CAR**, SHA-256
`bfe7ec1604263277c0fe4bca452fd1a35e418ba9c950bb7175e1e40f6fbbbf7b`,
is authenticated offline (99 blocks, 71 byte-compared files). Independent live
readback authenticates all 20 outer dependencies, reconstructs that exact CAR,
checks finalized DotNS records and receives identical HTTP 200 gateway bytes.
The local signer is removed immediately after capture and again at final cleanup.
No phrase, key or session proof is included in this record.

The initial launch stopped before signer capture or any network submission
because historical temporary dependencies had disappeared. The operator was
made independent using `npm ci` from frozen lockfiles and copied public support;
only import roots changed. The rejecting-signer rehearsal reached both DotNS
interfaces and descriptor-channel checks passed again before execution. The
artifact and approved write caps remained identical. No transaction was replayed.

Quota is now **509 transactions**, **168954299 store bytes**
and **210941854 renewal bytes**. Conservatively retain **291 future
renewals / 84,178,313 bytes**, including previous full trial obligations and all
20 dependencies of this version. **No renewal was sent.** Reused dependencies
still expire as early as block **1532185**; account authorization expires at
**1621405**. Reuse/root publication does not extend either expiry.

## Web and service boundary

[Netlify deploy 6aebdb8061be1498b8067714](https://app.netlify.com/projects/muzinga/deploys/6aebdb8061be1498b8067714) publishes the same
exact source. Production branch is frozen `release/product-0.1.73`; build/public
environment, previews and auto-publishing settings are otherwise preserved.
Operational records stay on this separate branch to avoid unmatched auto-builds.
Public readback reproduces `assets/index-BlMntINU.js`, **1,127,680 bytes**,
SHA-256 `710fd3cbcc592ef925e59d91dd86ed0346491de24248f99f264a2a0c74d9f697`.
Matching pinned dependencies and public settings reproduce these bytes locally;
a temporary non-source marker reproduces Netlify's `clean=false` identity and
is removed afterward. Public configuration digest remains
`0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9`.

**No service restart/deployment, media/registry write, key transfer, policy/grant/
CORS change, domain purchase or renewal occurred.** API/custody remain source
`e2dd614862a8d9e3c5373689f58195b069130c07` on the existing image and fresh-pilot
paths. Before signing, custody had no active job/pending intent; its one ready
audio job, 16 audio receipts and two metadata receipts were retained. No account
cursor, encryption reservation, attempt or queue was reset.
Readiness stays HTTP 200; unchanged manifest (1,990 bytes), encrypted init
(781 bytes) and first segment (48,419 bytes) return HTTP 200 without a key request.

## Evidence limits and next acceptance

Merged #386 passed 23 Classic browser cases, two protected-room cases and 18
related unit cases locally; three regressions failed before the correction.
Exact-source CI passes complete Web/Product, core flows, three-engine streaming,
Nearby, Host identity and sign-out checks. Two existing App.tsx hook warnings
remain; this rollout adds no new application behavior beyond #386.

The deployed public Free key route refuses this Classic release with `NOT_FREE`
and no key. This verifies that specific policy boundary; it does **not** prove a
real signed unentitled-listener rejection. The prior 0.1.72 owner report confirms
eight seconds audible on Web/Desktop/mobile. In response to the new Web
0.1.73 procedure (refresh, play as artist, disconnect before eight seconds,
reconnect without automatic playback, then explicitly retry), the owner reports
**“arrêt OK / reprise OK”**. This accepts the reported Web stop and explicit
recovery path. The owner subsequently reports **“Mobile : arrêt OK / reprise OK”**
and **“Desktop : arrêt OK / reprise OK”** in response to the same procedure for
Polkadot app 0.1.73. All three clients therefore have owner-reported audible stop
and explicit recovery. On mobile, disconnect currently requires returning from
the full player to Music; direct account access from Player is not implemented.
There is no independent per-device build/sound capture, timing or new device/OS/
network report. Account switching, room-guest silence and signed unentitled
denial are not established. For the remaining comparisons, follow the
[physical procedure](../../../operations/bulletin-protected-playback-acceptance.md),
recording version, role and audible result; never approve a payment for denial.
Conservation, off-volume recovery, costs and general admission remain W33 gates.
Rollback only matching client records/branch; retain all newer receipts and nonce
state. 0.1.72 also predates this interruption correction and is not a secure
substitute for accepting its new lifecycle behavior.

## Owner feedback queued for the next iteration

[Listening controls and discovery](../../listening-controls-and-discovery.md)
([#388](https://github.com/knzeng-e/dotify/issues/388)) records three requested
follow-ups: account/disconnect access inside the mobile player; actual current
track/release/artist details accessible inside a room; and lock-screen current
artwork with previous/next controls instead of the observed ±10-second buttons.
The room is a discovery surface: inspecting its track must not leave the room,
interrupt listening, request a guest key/payment or grant host control. Native
artwork/button acceptance needs per-Host/OS evidence. These are planned tasks,
not changes included in 0.1.73. They accompany Bulletin stabilization without
closing the access, retention and off-volume recovery gates.
