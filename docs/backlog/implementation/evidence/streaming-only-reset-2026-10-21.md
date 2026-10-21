# Streaming-only reset validation, 2026-10-21

Scope #320; owner decision ADR 0033. Source branch `refactor/streaming-only-reset`
is based on tested dev `151428b` plus the fresh-directory prerequisite #319
(`e5ceaab`). This records local source validation, not a live deployment.

## Local evidence

- Web: 966 unit tests / 123 files pass, including scoped key-cache identity,
  strict current refs, cancelled/truncated object reads and keyless prefetch.
- API: 194 tests pass, including independent subscriber cancellation over real
  loopback HTTP, rechecked catalog authority, registered-object-only relay,
  missing-worker 503 and durable owned upload jobs. Typecheck passes.
- Streaming format: actual-key nonce collision/overflow/crash checks remain;
  AES authentication binds the full release, object identity and rendition.
- The synthetic key-custody restore rehearsal passes with retained key v2 and
  active v3. It exercises current streaming ciphertext, not retired containers.
- Chromium core flows: Classic unlock and room host/guest scenarios pass;
  all 16 artist-publication scenarios pass, and the current startup telemetry,
  stale-media/selection cancellation and keyless neighbor-prefetch cases pass.
- Current-format continuity: 26 of 28 initial Chromium/WebKit cases passed;
  the two failed assertions expected a native-media error before any media
  existed in the Blob path. Corrected assertions require settled preparation,
  visible failure and paused output. All four authentication cases then pass
  in both readers/engines. Retries/truncation, pause during a held read, slow
  buffering, A/B/A, denied key and selection cancellation retain real AAC.
- Web, frozen Product and single-file Bulletin builds pass. Bulletin verifies
  self-contained scripts without the deleted DAV2 worker. Lint has no errors;
  two existing hook-dependency warnings remain in the E2E-only artist harness.
- Backlog offline validation and whitespace check pass.
- Isolated Docker publication rehearsal succeeds with synthetic media, the
  non-root API controller and separately resource-limited FFmpeg encoder.

Local Chromium and WebKit authenticated MSE tests pass for all three bitrates.
The local macOS WebKit Blob-playback case does not advance its media clock;
Firefox cannot launch because its macOS sandbox/graphics process fails. Keep
both tests enabled in the hosted Linux three-engine matrix; do not count these
local limitations as physical Safari/Product evidence.

## Remaining acceptance

Hosted CI is authoritative for this PR's exact revision and Linux browser
matrix. Record its result in the PR. No automatic suppression or replacement
with old-format fixtures is allowed. Physical Product Desktop/mobile, genuine
new-artist upload/pinning, prolonged listening/rooms, native access/tip receipts
and the coordinated service/client cutover remain W13/W32/#317 gates.

Nothing in this cleanup deletes live contracts, IPFS content, volumes, historical
custody or permanent nonce reservations, and no new secrets are provisioned.
