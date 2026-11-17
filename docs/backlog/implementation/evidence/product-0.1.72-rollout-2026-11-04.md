# Registered Bulletin playback rollout — 2026-11-04

Refs W33/#288. **Web and Product 0.1.72 are published and independently verified**
from `018011d405a3921c8a0cfda82ff9839d841e5d0d`, frozen branch
`release/product-0.1.72`, based on merged #385 / dev `cd97d4c1`.
[Exact-source CI](https://github.com/knzeng-e/dotify/actions/runs/41913980887)
is green (attempt 2). [Structured public receipts](product-0.1.72-rollout-2026-11-04.json)
record the artifact, writes, records, quota, unchanged release and readbacks.
The already registered musical release is preserved; replay it instead of
publishing it again. The owner confirms hearing all eight seconds on Web, Desktop and mobile.

## Why the clients changed

The [selection correction](bulletin-playback-source-2026-11-04.md) removes a
requirement for a direct audio URL before preparing encrypted playback. A
Bulletin directory has no direct full-track gateway URL. Explicit selection
and standby preparation must nevertheless enter the existing authorized key
and segmented-reader path. Key authority, access policy and payment remain
unchanged. A fake direct URL or public/decryption-key fallback is not used.

The fresh publication succeeded before this rollout: `Dotify-Bulletin-pilot-8s`
by **Thot Nzeng**, registered at block **15,321,680**, runtime
`0x05C643A1eD0e75C8A3486410f13BC4597c2674D7`, content hash
`0x66aae2bdd5859205f46c62291d93d6d5618e56201a507c2b9f5277823edafd35`.
It is encrypted Classic access at **1.42 PAS**, with generated artwork.
Audio root is `bafykbzacebebgmpnya5b5z3itktp653a4ru2fnzdaqpxjcq7kk2xpvcs23xlg`;
metadata is `ipfs://bafykbzacedwrk35v6yvt4fjhzwwf3apl7nddzsmtzdyxrihfxg6cstfhgnyfw/release.json`.
Readback before/after finds identical catalog entries, including the older
Adang Fobe release. Private preparation inventory before rollout has 16 audio
receipts and two metadata receipts, no pending intent or active writer.
No attempt, counter, grant, permit or encryption reservation is reset.

## Product publication and independent readback

The owner approved exactly the new app budget and activated the local signer.
At **22:04:48 UTC**, publication completed with **12 stores / 3,557,283 bytes**,
**eight reused blocks** and **two DotNS signing requests**. Finalized transaction
nonces are **1138–1149**; no uncertain submission remains. Both app records
resolve to `bafybeidgcw547jwr34erquh6zd73cooixsfmk3phhy7lfulq67nqbu7sem`,
and executable version is `[0,1,72]`. Branding, owner, resolver and the separate
0.3.1 diagnostic lab are unchanged.

The CAR is **9,413,124 bytes**, SHA-256
`5a0d120ead5f53a91e13ebf222d90c233a63d42f092af552f63346f9afd4144d`.
Offline verification authenticates 99 inner blocks and byte-compares 71 files.
Independent live readback authenticates all 20 outer dependencies, reconstructs
this exact CAR, checks DotNS and obtains identical HTTP 200 gateway bytes.
Signer capture removed `launchctl` immediately; final cleanup also confirms the
variable empty, with no secret displayed or retained in the record.

Authorization went from **533 to 521 transactions**, storage bytes from
**176,069,570 to 172,512,287**, with renewal bytes unchanged at **210,941,854**.
Conservatively reserve **271 renewals / 74,727,630 bytes**, including the full
fresh trial allowance and all prior reserved dependencies. Reserved quota is
not a renewal. Reused app dependency expiry remains as early as block
**1,532,185** (25,546 blocks after final publication quota head 1,506,639).
New root publication does not refresh a reused child or authorization expiry
(block 1,621,405). No renewal or scheduler was activated.

## Web delivery and service boundary

[Netlify deploy 6aebab773aaed203e867008b](https://app.netlify.com/projects/muzinga/deploys/6aebab773aaed203e867008b)
is published from the same exact source. Production branch is now frozen
`release/product-0.1.72`. Build/publish commands, public environment, preview and
auto-publishing settings are unchanged. Operational records stay on this
separate branch, so later documentation edits cannot trigger an unmatched build.

Canonical Web HTTP readback serves `assets/index-Dq2_7o9O.js`, **1,126,975 bytes**,
SHA-256 `380322f2b08a3e00b4be627b22cfc59f483258969af1c487cf0d1783612e7154`.
An exact-source local rebuild with matching pinned dependencies and public
settings reproduces these entry bytes. Netlify embeds `clean=false`; a temporary
untracked non-source marker reproduces that identity without modifying source.
The marker is removed and the frozen worktree is clean afterward. Public config
digest is `0d504400edfc50138a9d5f6df01a95bf42d6c6ca1160b52362afe6bc6b3193e9`.

**No service deployment/restart, music upload, registry write, domain purchase,
key transfer, policy/grant/CORS change or renewal occurred.** Existing API/custody
remain source `e2dd614862a8d9e3c5373689f58195b069130c07` on the previously verified
image. Public readiness is HTTP 200; the unchanged media manifest (1,990 bytes),
encrypted init (781 bytes) and first segment (48,419 bytes) return HTTP 200.
These ciphertext reads request no key and cannot prove sound.

## Validation, limitations and next action

Merged #385 has 15 local Classic browser tests and 24 related unit tests. Its
regression proves no premature key request, then preparation/source attachment
after simulated approval without a direct URL. It does not prove live settlement
or actual protected decoding. Exact-source release CI passed its complete
checks; its first browser job was cancelled during a slow Ubuntu dependency
download, then only that same-source job was rerun successfully, without changing
artifacts or budget.

Desktop reload opens the expected two-release catalog in a disconnected session;
no wallet action or protected playback was performed by that UI check. After reopening the clients, the owner reports: “web + Desktop + Mobile -> Succès.
J'ai entendu les 8 secondes”. This confirms the reported protected artist listening
path on all three clients for this release. It is operator-reported listening,
without independent sound capture, per-device build telemetry or startup timing;
it does not establish paid listener settlement, denied access or interruption
behavior. Earlier managed-reader diagnostic results remain separate evidence.
Protected denial/interruption, recurring dependency conservation, off-volume
recovery, representative costs and general editable/multi-release admission
remain W33 production gates. A rollback must preserve all newer receipts and
nonce/security state; do not republish music or restore stale private state.
