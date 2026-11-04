# Prepared-release recovery rollout — 2026-11-04

Refs W33/#288. Merged #384 is deployed to the API/custody roles and Web from
`e2dd614862a8d9e3c5373689f58195b069130c07`, frozen branch
`release/product-0.1.71`, based on tested dev `bb5d357a`.
[Exact candidate CI](https://github.com/knzeng-e/dotify/actions/runs/41821943011)
is green. **Product 0.1.71 publication is pending owner acceptance of the new
bounded app allowance and local signer activation.** Deployed Product remains
0.1.70 until independent record/readback evidence replaces this checkpoint.

## Recovery behavior and authority

The [recovery implementation](prepared-release-recovery-2026-11-04.md) handles
a ready audio job whose client editor has lost its original title, note, price
and artwork. An authenticated, scope-bound conflict offers the public saved
snapshot. The artist previews it and explicitly chooses whether to restore it.
Restoration sends no store or wallet transaction; a later Publish uses the
existing immutable name-only permit and artist-wallet registration.

The original saved pilot is `Bulletin pilot - 8s`, artist `Thot Nzeng`, price
1.21 PAS, note `A 8 seconds testing sound to measure Bulletin direct pubvlication`,
and its original cover. Preserve these exact admitted values, including the note's
spelling. The reconstructed filename title, generated cover and 1.2 PAS price
are not equivalent. No broader draft editing or additional admission is enabled.

## Verified services and preserved state

All three existing machines use image
`registry.fly.io/dotify-api@sha256:a4c53614d0040c8ec405a8f66cb92734873f8d1f5f0f19739967b9c414aad41c`:
private custody `e82d13d0c61238`, public edges `801939c6315568` and
`890e31c60749e8`. Private/public readiness is HTTP 200 and version readback is
exact source `e2dd6148`. The custody update preceded client delivery. Signaling,
contracts, database/session identity, grants, CORS, service count, policy and key
placement are unchanged. No music or app storage write was made by service rollout.

Before maintenance custody was already stopped following `CUSTODY_LEASE_LOST`
at 09:51 UTC. It had exited cleanly, so its existing `on-failure` policy did not
restart it. Starting that same old image restored read-only inspection before
upgrading. Loss of the shared ownership lease must still refuse work; investigate
supervised recovery from transient lease loss separately, without weakening that
boundary or allowing overlapping writers.

The actual attached encrypted volume is `vol_491jo391o8leqe5r`; the former
`vol_40o3jqwp33p5z6m4` identifier is retired. Snapshot
`vs_6bq7Ba7jyA9fXZz9R7Y9` was created at 11:43:33 UTC before update, retaining
14 days. All three original pilot inventory hashes match before and after,
audio remains ready with three preparation attempts, the exact name-repair permit
is present and there are no active jobs or pending intents. No stale nonce state,
allowance, attempt, receipt or lock was reset. No key was read or exported.
Snapshots remain within existing Fly storage and can include the already installed
full-authority DotNS/storage key; they do not prove off-volume disk-loss restoration.

Read-only retention authenticates all 26 existing pilot blocks / 734,495 bytes.
Earliest pilot expiry is block 1,679,653. The original two pending corrected
metadata blocks / 1,101 bytes remain the previously authorized name-only repair,
not another allowance or an operator-issued metadata publication.

## Web checkpoint

[Netlify deploy 6aeb1ef96a3e255c24945e0b](https://app.netlify.com/projects/muzinga/deploys/6aeb1ef96a3e255c24945e0b)
is published from exact source `e2dd6148`. Production branch is now
`release/product-0.1.71`; all other Netlify settings are preserved. Keep this
branch frozen. Documentation changes use the separate record branch.

Canonical HTTP readback finds `/assets/index-CU1WHZnV.js` (1,125,750 bytes,
SHA-256 `801704b19b28b98a789b47ed6cb331653821fbfd435ab7e210b44b8f26621185`).
An isolated exact-source clone with lockfile-installed dependencies and the same
public VITE settings reproduces these bytes exactly. Netlify embeds `clean=false`;
reconstruction reproduces that metadata with an untracked non-source marker,
without claiming Netlify has a clean worktree. The build config digest is
`0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9`.
This is served-artifact evidence; physical publication remains unverified.

## Prepared Product and remaining gates

The verified 0.1.71 CAR is 9,411,899 bytes, SHA-256
`151aac58ef414001a2916c71952b1545c1d1f61b13506ae07935eaabd6ccaf29`, storage root
`bafybeif4pfbnciadjc3yasvn5penvfrwa2hqdfdmeamvwh7xuvwvmoavq4`.
Independent offline verification authenticates 99 inner blocks, 71 files and
20 outer blocks; repeated reconstruction is byte-identical. Eight retained blocks
can be reused after fresh checks. New Product writes are bounded at 12 stores /
3,556,058 bytes and two DotNS signing requests, pending explicit owner acceptance.
A missing reused block stops for replanning, never an extra upload. No domain
purchase, music upload, renewal or diagnostic lab update is included.

Conservatively retain 191 older renewal transactions / 54,189,398 bytes plus
all 20 Product dependencies and two pending corrected metadata dependencies.
The preflight requires 235 transactions and 63,639,252 renewal bytes; observed
quota is sufficient (363 transactions / 116,570,014 renewal bytes). The earliest
reused Product dependency expires at block **1,532,185**, 31,737 blocks after
reuse head 1,500,448. A fresh root does not renew reused children. Conservation
is an immediate follow-up; no renewal or scheduler is claimed here.

After Product readback: have the artist restore the prepared release, submit the
normal corrected metadata request, approve registry publication and verify catalog
convergence and protected allowed/denied listening on Web/Desktop/mobile. These
remain physical/live acceptance, not inferred from CI or service readiness.
W33 remains open for them, conservation/bounded renewal, coherent off-volume
restoration and representative performance/cost evidence.
