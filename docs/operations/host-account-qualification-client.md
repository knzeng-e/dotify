# Public-account qualification client

The [exact native publication plan](host-account-0.1.90-publication-plan-2026-11-22.md)
now binds the 0.1.90 artifact from merged `ecba4ea0`, five Bulletin operations and
two DotNS signatures. It is unexecuted: explicit authorization is needed for
temporary custody maintenance and this new paid publication. Public/offline
checks pass; actual custody-environment readiness remains pending after the
automatic review blocked its command before startup. No new phone action yet.

Use this isolated candidate for #85 after the accepted
[iPhone Host-info observation](../backlog/implementation/evidence/host-info-ios-0.1.89-2026-11-22.md).
It prepares Product **0.1.90**, purpose `host-account-addresses-only`, for
`dotify-test01.dot`. It is source preparation, not a delivered Product or a
physical account/signing result. The delivered 0.1.89 reader remains unchanged.

The [source-bound local evidence](../backlog/implementation/evidence/host-account-qualification-2026-11-22.md)
records the clean artifact and scoped checks; it is not a phone result.

## What the account check establishes

The user first requests the bounded Host-info reading. Only a supported Runtime
0.31.x enables **Share my Dotify account**. That separate gesture calls installed
Host SDK `getAccountsProvider().getProductAccount('dotify-test01.dot', 0)` once.
No account is requested on page load, after unsupported info or after a failed
attempt. There is no browser wallet, demo account, profile/login request, signer
construction, message/transaction signing, chain query or Dotify API call.

The SDK returns an app-scoped Product account, not necessarily the same address
as a primary wallet or another Product. Its adapter echoes the requested Product
and index; those context fields are not an independently returned Host proof.
The reader validates that context and a nonzero 32-byte key before deriving
SS58 (prefix 42) and H160 with the installed address SDK. Native keys use its
Revive keccak derivation; EVM-derived keys use the 0xee-padding rule. Tests cover
both with fixed public vectors. No historical artist address is assumed.

These are **local address derivations**, not an on-chain `OriginalAccount`
verification, proof of signer control or artist authority. A separate unchecked
owner acknowledgement records the intended account choice; checking it does not
prove signing or grant access. The observation is a historical snapshot, not a
live wallet session. Do not use its report to authorize a contract or key grant.

## Failure, privacy and lifetime

One lookup may be outstanding per document. The 60-second deadline includes SDK
loading; timeout or unmount cannot accept a late result or initiate a queued
request. The SDK lookup has no cancellation parameter: after it starts, an
already-open Host prompt may outlive the page deadline. No automatic retry is
made. Retain a failure report before reopening the candidate.

Only in-memory public key/addresses, fixed requested context, sanitized Host and
source/configuration labels enter `dotify.account-qualification.v1`. The report
separates info-request time from the account-attempt time. It marks signing,
chain mapping, chain reads, signer control and runtime creation as unverified.
Raw Host errors, unrelated fields and personal profile data are not exported.
No local storage, backend or account database is written. Copying requires an
explicit button and warns that the report includes public addresses; a selectable
report remains available if clipboard permission fails.

## Build, identify and review

From clean committed source:

```sh
cd web
npm run test:qualification
npm run build:account-qualification
npx playwright test --config playwright.qualification.config.ts --workers=2
```

The artifact is `web/dist-account-qualification/`, separately from the info-only
`dist-qualification/`. Its `qualification-build.json` binds source, clean state,
configuration digest, Product/app/SDK identity and hashed served files. Purpose,
index and SS58 prefix participate in the account build digest. Clean-source,
secret/E2E rejection, rendered-module allowlists and the 100-file / 3-MiB envelope
apply to both profiles; the info-only graph still refuses account modules.
CI compiles both. The listener, runtime adapters, catalogue and fake Host fixtures
cannot enter either application's rendered graph.

Review `web/src/qualification/account.ts`, `accountReport.ts` and
`AccountQualification.tsx`, then `web/scripts/qualification-profile.mjs` and the
build script. Unit cases exercise mismatched/malformed/denied/unavailable
responses, both address rules, bounded/cancelled/late results and report scope.
Browser fixtures exercise the installed SDK adapter in Chromium/WebKit, including
explicit gestures, no external service requests and mobile address wrapping.
These mocked accounts are not physical Host evidence.

## Device handoff and remaining gates

Do not ask for another phone report until a reviewed, source-identified account
artifact is delivered under its own publication scope. The consumed 0.1.89 plan
is not authority to publish 0.1.90. Follow the
[qualification procedure](../how-to/qualify-product-host-031.md#account-and-listening-acceptance)
for ordinary account consent and the owner-selected artist account. Compare the
reported public addresses with that intended Product account before acknowledging
it, then preserve the report. An account mismatch, denied or malformed result
stops this gate; it must not launch a signature or a second attempt.

Before artist onboarding, independently verify the native chain account mapping,
fresh-deployment attestation and native-aware pending-runtime discovery. The
[matched-generation configuration](deployment-configuration.md#native-payment-correction-candidate-484)
also needs its services/key/profile context before protected access, native
beneficiary settlement and listening/Rooms. This candidate creates no runtime,
activates no service, submits no payment and enables no CASH flow. #85 and #317
remain open.
