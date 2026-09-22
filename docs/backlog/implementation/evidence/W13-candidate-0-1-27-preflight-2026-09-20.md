# W13 candidate 0.1.27 preflight — 2026-09-20

## Identity

- Scope: W13 follow-up after PR #205 merged the backlog reconciliation.
- Starting `dev` SHA: `a36d60e6848cfde55511a1cba8b934cd213af8b9`.
- Reviewed implementation commit: `c8f1a0d1e13efc16a5dc76909d37dadf45d59e52`.
- Branch: `feat/w13-candidate-validation`.
- Issue: partial W13 issue #158.
- Tracked Product executable version: `[0, 1, 27]`.
- Published Product executable: `[0, 1, 27]`, merge SHA
  `a08de52e1bc5a9db5dfd34ae96b7250cbe567276`, CID
  `bafybeihzx3ck2i2zd5uvsq646uchxd563s27scvic5a2slanqsk6wifgca`.
- Code readiness: locally verified.
- Release readiness: **hold**. Version `[0, 1, 27]` is published and the
  read-only Product DevNet smoke passes, but no candidate-bound payment/key,
  room, physical-device, rollback, or participant evidence has been accepted.

## Result and decisions

Product Desktop rendered labels from an older Dotify bundle: the support action
said **Continue**, the account option said **Use EVM wallet**, and the current
`Production readiness` panel was absent. Those observations do not match the
published `[0, 1, 26]` source, so the open host instance is treated as stale and
is not accepted as candidate evidence.

The stale UI exposed a separate source-level failure mode that still existed on
`dev`. The Classic support receipt, account selector, and transaction feedback
all use the same dialog layer. If the connected account disappeared after the
receipt was prepared, `performTrackSupport` opened account selection without
dismissing the receipt. Depending on DOM order and host repaint timing, the
selector could remain behind the receipt and make the confirmation appear
unresponsive.

The support flow now clears the receipt before every handoff to account
selection, signer/setup errors, or transaction progress. It rechecks the
account again after asynchronous payment-intent preparation and restores the
account dialog when that identity changed while the chain lookup was pending.
Deterministic Playwright scenarios cover account loss both before confirmation
and during intent preparation; each verifies that exactly one dialog remains,
no payment attempt starts, and recovery stays visible. Product `appVersion`
advances to `[0, 1, 27]` because the change affects runtime payment behavior
and host cache freshness.

The Product runbook now rejects stale host UI as release evidence. If the
expected readiness panel or current labels are missing, the operator must stop,
close Dotify, clear only Dotify's local Product cache with explicit approval,
reopen it, and re-grant the required permissions before collecting evidence.
This cache operation does not authorize a payment or a publish.

## Verification

| Command or scenario | Environment | Result |
| --- | --- | --- |
| `npm run test:e2e -- e2e/classic-unlock.spec.ts -g 'account loss' --reporter=line` | Local Chromium | Passed: 2 regression scenarios covering loss before confirmation and during intent preparation. |
| `npm run test:e2e -- e2e/classic-unlock.spec.ts --reporter=line` | Local Chromium | Passed: 10 Classic access/payment/recovery scenarios. |
| `npm run test:e2e -- e2e/design-surfaces.spec.ts -g 'core navigation reflows' --repeat-each=5 --workers=2 --reporter=line` | Local Chromium | Passed: 20 checks across 360, 390, 768, and 1440 px. The test now waits for the selected client-side view and loaded fonts before polling layout overflow, removing the stale-frame race seen twice in CI. |
| `npm run test:unit` | Local Node 22 | Passed: 73 files, 580 tests. |
| `npm run lint` | Local | Passed with 0 errors and 3 inherited React hook dependency warnings in `App.tsx` and `ArtistShell.tsx`. |
| `npm run build` | Local | Passed. Inherited Rollup annotation, mixed-import, and large-chunk warnings remain. |
| `npm run build:product-devnet:support` | Local Product CDM profile | Passed. The live catalogue refresh was unavailable, so the generator retained the reviewed checked-in bootstrap; the build completed with the same inherited bundle warnings. |
| `npm run smoke:devnet` | Live read-only Product DevNet endpoints | Passed: 6 checks at Asset Hub head `13490727`, including chain `420420417`, factory/directory bytecode, Bulletin, and IPFS responses. |
| `npm run smoke:signal -- --url https://dotify-signal.fly.dev --origin https://dotify-test01.dev-dot.li --denied-origin https://not-dotify.example --room` | Live signaling, temporary room | Passed: health, origin boundary, room `VS5B8R`, walletless guest join, and full playback mode. |
| `npm run smoke:product-journey` | Current `dev`, no live evidence JSON | Expected `blocked`: 28 pass, 0 fail, 1 blocked, 1 not run. |
| `npm run smoke:pilot-release` | Current `dev`, no live evidence JSON | Expected `blocked`: 79 pass, 0 fail, 2 blocked, 8 not run. |
| Product Desktop read-only inspection | Existing local Product host | Stale bundle detected; no payment, account connection, cache deletion, or publish was performed. |

## Security, failure, and operations

- Account loss fails before payment and exposes one recoverable account choice.
- No transaction, signature request, content-key request, deployment, contract
  change, or participant contact was initiated.
- The account-loss fixture exists only in the explicit Playwright Classic
  scenario and cannot activate in normal builds because the Classic E2E mode is
  compile-time disabled there.
- The version bump intentionally invalidates candidate-bound evidence. Evidence
  for `[0, 1, 26]` cannot be relabeled as `[0, 1, 27]`.
- Clearing Product Desktop's local Dotify cache remains pending explicit
  operator approval because it deletes local application state. It may require
  domain and WebRTC permissions to be granted again.

## Remaining gates

1. Confirm host cache freshness, then reuse the existing paid entitlement to
   export Product payment/access read-back without submitting another payment.
2. Export a Product-hosted room journey with a walletless listener, and capture
   physical iPhone first-sound plus independent-network/TURN evidence.
3. Rehearse the recorded `[0, 1, 25]` rollback and restore `[0, 1, 27]`, then
   publish the distinct default-`viem` release candidate.
4. Run the consented aggregate pilot before recording `go` or closing #158.

Implementation summary: candidate `[0, 1, 27]` removes a modal-stacking dead end
from Classic support, makes Product cache freshness an explicit evidence gate,
and keeps W13 on hold until the new executable is reviewed, published, and
validated on its supported live surfaces.

## Post-merge candidate identity gate — 2026-09-21

PR #206 merged into `dev` at
`1bb86cf9bbd1f38ff6f6ae96c1e1213dc586edce`. Before dispatching the
signer-free validation workflow, the operator found that its human-readable
summary still hard-coded `[0, 1, 26]` even though the tracked deploy config and
the actual bundle were `[0, 1, 27]`. Publishing was paused because that mismatch
would make the otherwise exact-SHA evidence ambiguous.

Commit `98f3b35dee35181bd9562e07de1d3202b7f97c4e` removes the duplicate version
constant. The workflow now parses `appVersion` from the same tracked Product
deploy config used by publication, validates every complete decimal token and
safe integer in the tuple, and writes that value to the workflow summary. A
missing, partial, non-decimal, or unsafe version fails before the build.

Local verification passed: the workflow YAML parses, the identity parser emits
`[0, 1, 27]`, the nine pilot-readiness tests pass, the Product journey reports
28 static passes with zero failures, and the offline backlog check passes. No
mnemonic was available to the agent process, and no publish, payment,
transaction, signature request, cache deletion, or participant contact was
performed. The next candidate identity is the future merge SHA of this
correction; signer-free validation and local publication must bind to that SHA,
not to `1bb86cf` or the implementation commit above.

## Product CDM validation publication — 2026-09-21

PR #207 merged into `dev` at
`a08de52e1bc5a9db5dfd34ae96b7250cbe567276`. The exact SHA was checked out in a
clean detached worktree at `/tmp/dotify-product-0-1-27`, built with the Product
CDM validation profile, and published locally with the authorized DotNS owner
mnemonic supplied through an ephemeral FIFO. The mnemonic was not written to a
file, committed, added to GitHub secrets, or printed in command output.

The Product DevNet publication completed successfully:

- Product appVersion: `[0, 1, 27]`.
- Root CID: `bafybeihzx3ck2i2zd5uvsq646uchxd563s27scvic5a2slanqsk6wifgca`.
- Domain: `dotify-test01.dot`.
- Product account: `5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca`.
- Product H160: `0xe3e3a0916d27c5174313f16e1507a286985a8ac8`.
- Storage Phase A finalised at block `933425`, tx
  `0x3d935fc48ccedf7b98427dbb286e8c5250f7f58a0624d0ee4ee16d879d9d2745`.
- Storage Phase B finalised at block `933429`, tx
  `0x020eca9a63a88d619bde9fb7ac8ed98368fd1135b0d642e45d4180f41f5aa203`.
- `dotify-test01.dot` contenthash finalised at block `13516739`, tx
  `0xf8841c8678acd61da4bf2d8cf8eb4d0a7ad1935c2e325f8d8eabe9e8cb461080`.
- `app.dotify-test01.dot` contenthash finalised at block `13516753`, tx
  `0xd58c6a247a446e5ffd1faeaca2cb3957ef9863f613ff6e1bfa3b4300d409d85a`.
- `app.dotify-test01.dot` text record `executable` was verified as
  `{"$v":1,"kind":"app","appVersion":[0,1,27]}` with tx
  `0xd6155e5765dd9e9e4564e25d471255ecf481df13535f449acf18c929e7b62d94`.
- P2P retrieval passed in `46ms`.

Post-publish validation passed with network access:

| Command or scenario | Environment | Result |
| --- | --- | --- |
| `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm VITE_DOTIFY_ARTIST_DONATIONS=on VITE_DOTIFY_DEBUG_PANEL=true npm run deploy:product-devnet` | Exact merge SHA `a08de52`, local DotNS owner mnemonic via FIFO | Passed: build, Bulletin upload, finality, DotNS contenthash, executable text record, and P2P retrieval. |
| `VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm VITE_DOTIFY_ARTIST_DONATIONS=on VITE_DOTIFY_DEBUG_PANEL=true npm run smoke:devnet` | Live read-only Product DevNet endpoints | Passed: 6 checks at Asset Hub head `13516791`, including chain `420420417`, factory/directory bytecode, Bulletin, and IPFS responses. |
| `npm run smoke:pilot-release -- --md-out /tmp/dotify-pilot-release-after-0-1-27-publication.md --json-out /tmp/dotify-pilot-release-after-0-1-27-publication.json` | Local release-readiness gate after publication | Expected `blocked`: 79 pass, 0 fail, 2 blocked, 8 not run. Product CDM host smoke, room evidence, rollback, pilot release CID, and aggregate pilot evidence remain missing. |

This publication proves reproducible Product CDM delivery for `[0, 1, 27]`. It
does not prove the W13 pilot journey. Payment verification remains suspended by
operator instruction, and the next accepted evidence must come from the
candidate-bound Product host UI after cache freshness is confirmed.
