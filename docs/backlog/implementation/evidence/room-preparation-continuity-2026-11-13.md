# Solo-to-Room preparation continuity — local evidence, 2026-11-13

Scope: [#395](https://github.com/knzeng-e/dotify/issues/395).
Design: [ADR 0059](../../../adr/0059-preserve-solo-during-room-preparation.md).
Candidate source: `55623cbb4917dada8dc0d97ab2dc19690be7b097`.
Branch sync `21d21ebc` incorporates owner-merged #455; the frontend and browser
fixture trees are identical to `55623cbb`.

This is implementation/browser evidence. No app or service was deployed, no
musical asset was read or uploaded, and no physical iPhone acceptance is claimed.
The controlled wait does not measure faster network preparation or real acoustic
output. The approximately 55-second owner observation is not a new benchmark.

## Results

Environment: source Mac, verified Node 22.23.5, existing locked frontend
dependencies and local Chromium/WebKit engines. Synthetic encrypted AAC comes
from the existing generated codec fixture; its key is a public test key.

| Check | Observed result and scope |
| --- | --- |
| Frontend unit suite | 151 files, 1,167 tests passed, including four preparation-owner/deadline tests |
| Complete encrypted-audio browser suite | 101 passed, one designed Chromium skip for the native WebKit-only case; that case passes in WebKit |
| New handoff scenarios in both engines | Media/transport remains usable during a held manifest read, seek survives handoff at the live position, explicit Pause stays paused, cancel/track change reject late preparation |
| New failure scenarios in both engines | A transport failure preserves solo; authoritative key denial retires solo and clears the access hint |
| Web build / Product DevNet frozen build | Both pass; existing large-chunk build warnings remain |
| Lint | Pass, zero errors; the two pre-existing App.tsx hook warnings remain |
| Backlog and documentation | Offline manifest, changed Markdown links/anchors and public HTML paths checked; live Project alignment checked separately before PR completion |

The preparation-owner tests cover all three parent lifetime cancellations,
a transport that resolves after cancellation, a replacement candidate whose old
cleanup must not cancel it, identity drift, and a 60-second deadline armed only
after authorization. The new browser cases hold a **new manifest request** after
controlled expiry of the existing 30-second ciphertext cache. They use the real
reader, authentication, complete AAC assembly and native media elements. They do
not change playback clocks or emulate acoustic iPhone output.

The final full browser run held source/fixtures unchanged. An earlier full run
was invalidated by an overlapping fixture edit that reloaded a WebKit page;
its failure is not counted as acceptance or hidden by relaxing an assertion.
A paused-handoff assertion waits for metadata/seek completion rather than treating
an initially paused, unloaded element as a restored position.

## Reproduce

From `web/`, with Node 22 and the locked dependencies, generate the existing
synthetic streaming fixture using the API codec-fixture procedure in the
[quality workflow](../../../../.github/workflows/dev-quality-gates.yml).
Then run:

```sh
npm run test:unit -- --maxWorkers=2
npm run build
npm run build:product-devnet:frozen
npm run lint
DOTIFY_STREAMING_FIXTURE_PATH=/path/to/generated/streaming-fixture.json npm exec -- playwright test --config playwright.audio.config.ts
```

The browsers need a local loopback Vite server and installed engines. No live
wallet, key service, RPC or real music is used by the synthetic audio suite.

## Remaining acceptance

Follow [the matched Room-start guide](../../../how-to/measure-room-startup.md)
after a reviewed Web/Product delivery. Repeat full-length same-track Room starts,
record original and handoff attempts, verify host and Web/Desktop guest sound,
and exercise Pause, cancellation, disconnect, lock/unlock during preparation and
after hosting. Keep #395 open for those results and measured actual startup
improvement. This change does not expand a publication, maintenance or key-export
budget, resume the deferred recovery trial, or close the broader public-pilot goal.
