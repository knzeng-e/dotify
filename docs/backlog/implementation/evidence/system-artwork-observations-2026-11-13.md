# Artwork preparation and rejected metadata — local evidence, 2026-11-13

Source: `fdfe3d769cc2589a833acbb292df4c620d357e34`, based on dev `bbccff31`.
Refs [#388](https://github.com/knzeng-e/dotify/issues/388).
The [observation reference](../../../reference/system-artwork-observations.md)
owns fields, limits, privacy and platform boundaries; the
[device guide](../../../how-to/check-system-artwork.md) owns physical collection.

No client/service was deployed. No real music, account key, Fly inspection or
recovery trial is part of these checks. This does not establish why the owner's
iPhone cover sometimes appears late, a native speedup or physical background
acceptance. The #448 cache corrections are already in dev; they still await that
matched physical acceptance.

## Local results

Verified Node 22.23.5 and the locked frontend dependencies on the source Mac:

- **1,170 unit tests / 151 files pass.** Seven added cases cover timing/visibility,
  bounded/detached observations, retired generations after clearing, strict export
  fields and invalid input, acquisition/decode/composition versus prepared reuse,
  and inclusion in the existing support report without image/account/key detail.
- **Eight Chromium and nine WebKit scenarios pass.** Existing generated PNG,
  320/390/430-pixel account access, stalled persistence, Room attribution and warm
  prepared-cover reuse remain. Added assertions correlate phase evidence with
  actual canvas/metadata registration and reject post-disconnect completion.
  WebKit's existing host-output autoplay scenario also passes. Registration in
  these fixtures is not acoustic or native lock-screen display evidence.
- Web and frozen Product DevNet builds pass. Lint has no errors, retaining the
  two pre-existing App.tsx hook warnings. Existing large-chunk warnings remain.
- Offline backlog and changed documentation link/anchor checks pass. The live
  Project check is recorded with the PR workflow, not inferred from CI's designed
  token-less skip.

The source report adds only a bounded optional `artwork` array. Existing streaming,
host/output observations, explicit copy/fallback UI and schema identity remain.
There is no new analytics transport, persistence, wallet/key request or timer loop.

## Reproduced metadata failure

A controlled local Host rejects `MediaSession.metadata` writes, including null.
On `f0d267478a7a3685e6e66969c88651f3982e557a`, the corrected mobile-viewport test
reaches Disconnect, removes audio, then loses the player/account UI because the
cleanup write escapes. Guarding metadata clear operations lets the same test keep
that UI available with no unhandled page error. This is a demonstrated partial-Host
failure boundary, not evidence that the tested iPhone rejects these writes.

The detached baseline and corrected candidate use byte-identical tests:

| Artifact | SHA-256 |
| --- | --- |
| `listening-controls.spec.ts` in both runs | `0b6bc0168132dd1177f0ee1ec1cae5cd50a3790a2315d9fcba3ce7ac9164af84` |
| Baseline `useSystemMediaSession.ts` | `477220813a75aebd35ef3cbb6d60aa8748bddb4a4d1a90e31e7285dfac82cd44` |
| Corrected hook | `a2d2e20b62a4e87a4cce617a2e78d392bb98044b4d6127f63729dfa906cc2e0e` |

An initial probe used a mobile-only button at desktop width and did not prove
the defect. It is excluded from acceptance. The exact comparison above fixes
the viewport, waits for an initial PNG and changes neither the assertions nor
timeouts between baseline and candidate. Final browser runs hold source unchanged.

A rejected native clear is recorded as failure, not as an acknowledgement that
the OS removed its old cover. Dotify still retires the owner, aborts preparation
and keeps playback/account cleanup working. Native rendering remains a separate
boundary, consistent with the W3C reference linked from the observation contract.

## Reproduce and remaining work

From `web/`, with Node 22 and installed browser engines:

```sh
npm run test:unit -- --maxWorkers=2
npm run build
npm run build:product-devnet:frozen
npm run lint
npm exec -- playwright test e2e/listening-controls.spec.ts --project chromium --workers=1
npm exec -- playwright test --config playwright.listening-webkit.config.ts
```

After reviewed matching delivery, collect repeated solo/Room phone locks, rapid
changes, native navigation and actual host/guest sound with the support report.
The current #395 Room candidate is independent and not included in this source;
merged/integrated delivery needs its own exact-source checks. Keep #388 and the
broader pilot goal open. Real independent recovery remains deferred as requested.
