# Public-account qualification source — 22 November 2026

**The separate 0.1.90 source candidate passes local qualification checks. It is
not published and has no physical account/signing acceptance.** Source
`4fbd60fafa54a403575063f116084834ee3deaaa` starts from merged #505 / `dev`
`3ae5626c4c56a0cbb9a83911529d34602a2d20cb`. The
[structured record](host-account-qualification-2026-11-22.json) binds its clean
artifact, configuration digest and served file hashes.

The [client reference](../../../operations/host-account-qualification-client.md)
owns behavior, failure handling, privacy and handoff. This candidate separates
explicit account consent from the accepted 0.1.89 Host-info observation. Public
Substrate/EVM derivation and an unchecked owner acknowledgement do not prove
native chain mapping, signing control or artist authority.

## Validation

- 38 focused Vitest tests and three build-profile tests pass: both address rules,
  invalid Product/index/key, unsupported Runtime, denial/absence, timeout/abort,
  late-result rejection and the narrow report. Info-only guards still reject
  account modules; both graphs reject listener/runtime/testing capabilities.
- Fourteen Chromium/WebKit scenarios pass through the installed SDK adapter with
  fake Host responses. They cover explicit separate gestures, mobile address
  wrapping, report allowlists/acknowledgement and denied/malformed results without
  a second prompt. Mobile WebKit output was visually inspected. These are not
  owner-device or live-account observations.
- TypeScript, formatting and lint pass; lint retains the two existing unrelated
  `App.tsx` hook dependency warnings. Both clean isolated builds pass their graph
  and file/byte guards. Rollup removes an existing unrecognized pure-comment
  annotation in `@scure/base`; it does not fail either build.
- All seven served account files are independently byte/hash-checked against the
  build manifest. The manifest excludes itself from the file list; eight files
  exist including that manifest. No CAR, Bulletin CID or new delivery is claimed.

No application/API deployment or blockchain write occurred. Native mapping,
fresh-factory attestation/pending-runtime discovery, artist-signed creation,
matched services, payments and listening remain separate gates. #85 and #317
stay open; the completed 0.1.89 authorization does not cover this candidate.
