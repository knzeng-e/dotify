# Bulletin public release assets: implementation evidence

Refs #288 (W33), #287. Started from tested `dev` `a74c5242d2fc983b2bd64c3585aea24659516bea`, after #373. Owner-selected scope: complete Bulletin covers/metadata after the confirmed Pinata free-account file limit. This record is not a rollout or a new network allowance.

## Implemented behavior

The existing publisher owns all three release parts. A separately initialized immutable public-asset policy admits one cover and one metadata graph for the exact artist/runtime/content scope, each with its own attempted-store/byte cap. It preserves the existing audio profile hash, exhausted preparation attempts, encrypted output and nonce ledger. Shared serialization and account-wide pending barriers prevent concurrent writers from reusing sequence numbers. Canonical artist authority is checked again when public work reaches the writer; grants still bind session, purpose and uploaded-byte budget.

The first metadata bytes are durably preserved so rebuilding only `createdAt` after a lost response reuses the original CID/receipts. Actual changes remain refused in this bounded pilot. Covers retain the original and five variants. Public generations are clearly tagged; no content key is written in the public layout. Graph construction reuses deterministic BLAKE2b UnixFS addressing without relaxing audio-manifest admission. The one-line store/reserve accounting correction from #375 is necessary for exact caps and matches that separate fix; #375 is now merged into dev and retained by this integration.

Web reads public assets through a fixed-path relay on the existing API. Native Host-aware fetch/cache paths verify raw preimages before reconstructing the selected image/JSON; the same API is their recovery path. No Pinata or arbitrary-gateway fallback exists for Bulletin identifiers. The public relay deliberately supports studio previews before catalog registration; it verifies CIDs, fixed paths, supported image magic and strict release JSON, bounds concurrency/bytes/traversal/deadlines and excludes audio/archive/key paths. Canonical runtime state remains the access/payment authority, not metadata claims.

## Review order and boundaries

1. `bulletinPublicAssets.ts` / `streamingPublicationStore.ts`: immutable policy and graph ownership, first-input persistence, current artist authority, account serialization, cumulative renewal reserve and pending-nonce refusal.
2. `uploads.ts` / `publicAssets.ts`: signed grants remain required for writes; reads expose only bounded public content and failures reveal no provider body. `releaseManifest.ts` is the existing strict schema moved to a shared module.
3. Client `bulletinPublicAssets.ts`, `bulletinHostMedia.ts`, `pinata.ts`, `publicArtworkCache.ts`: native verification/cancellation, explicit API recovery, stable immutable artwork-cache keys and no Pinata race.

[ADR 0044](../../../adr/0044-bulletin-public-release-assets.md) explains the design/tradeoffs. The [runbook](../../../operations/bulletin-public-assets.md) covers additive provisioning, configuration, acceptance and rollback. No new service/subscription or secret authority is introduced. The current server key still has the full account authority previously approved by the owner. Readiness now treats Pinata as unnecessary on edges and a fully Bulletin custody path, while explicitly avoiding a claim of live quota or retention verification.

## Validation

Integrated implementation `9deb8aef` includes the #375 prerequisite with its safe error diagnostics and exact-cap regression:

- Full API suite: **301 tests pass**, including grants/authority, shared account cursors, uncertain-submission barriers, immutable asset limits, timestamp-only metadata replay, bounded public reads and role-aware readiness. Local HTTP bind/disconnect tests require execution outside the sandbox; the final full run passes there without external writes.
- Full Web unit suite: **1,058 tests pass** across 138 files. Real DAG/native-reader tests verify selected-path reconstruction and rejection of private paths; transport tests prove no Pinata fallback, correct API recovery and cancellation.
- API typecheck and Web production build pass. Web lint has no errors and the two existing `App.tsx` hook warnings; builds retain the existing large-chunk warning. The unit rendering harness emits existing server-render `useLayoutEffect` warnings.
- Product DevNet frozen build and the offline backlog manifest check pass. The final private-policy-directory/20 s fetch-deadline refinement (`3f2f09dd`) passes all seven writer/relay tests and the 37 client transport/cache tests again. Live CI remains a PR gate. All data are synthetic and all store/signature transports in these tests are local fakes. No live Pinata/Bulletin upload, renewal, key transfer, filesystem reset or service change was performed.

## Remaining acceptance

The existing failed audio job still needs reviewed recovery without resetting its three attempts. Public assets need a separately reviewed exact write budget and explicit configuration; choosing this implementation did not authorize additional network writes. The admission fix #375 is merged; review the asset change before activation. Coordinate Web/Product resolver rollout with the server before issuing new references. Artist-wallet registration, protected Web/Desktop/mobile listening/payment, measured costs/throughput, off-volume recovery and recurring retention remain open. This does not close W33 or certify production readiness.
