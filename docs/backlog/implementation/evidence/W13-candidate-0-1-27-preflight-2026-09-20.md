# W13 candidate 0.1.27 preflight — 2026-09-20

## Identity

- Scope: W13 follow-up after PR #205 merged the backlog reconciliation.
- Starting `dev` SHA: `a36d60e6848cfde55511a1cba8b934cd213af8b9`.
- Reviewed implementation commit: `c8f1a0d1e13efc16a5dc76909d37dadf45d59e52`.
- Branch: `feat/w13-candidate-validation`.
- Issue: partial W13 issue #158.
- Tracked Product executable version: `[0, 1, 27]`.
- Published Product executable: `[0, 1, 26]`, merge SHA `1a226f4`, CID
  `bafybeibbxfn5nw3mb7hgxoou357xiee5ow2iyxlpfycwd3pdigitgrth2i`.
- Code readiness: locally verified.
- Release readiness: **hold**. Version `[0, 1, 27]` is not published, and no
  payment, room, physical-device, rollback, or participant evidence was created
  in this follow-up.

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

1. Review and merge this candidate, then publish `[0, 1, 27]` from its exact
   merge SHA under a new CID. Do not use the earlier `[0, 1, 26]` CID as evidence
   for the changed code.
2. Confirm host cache freshness, then reuse the existing paid entitlement to
   export Product payment/access read-back without submitting another payment.
3. Export a Product-hosted room journey with a walletless listener, and capture
   physical iPhone first-sound plus independent-network/TURN evidence.
4. Rehearse the recorded `[0, 1, 25]` rollback and restore `[0, 1, 27]`, then
   publish the distinct default-`viem` release candidate.
5. Run the consented aggregate pilot before recording `go` or closing #158.

Implementation summary: candidate `[0, 1, 27]` removes a modal-stacking dead end
from Classic support, makes Product cache freshness an explicit evidence gate,
and keeps W13 on hold until the new executable is reviewed, published, and
validated on its supported live surfaces.
