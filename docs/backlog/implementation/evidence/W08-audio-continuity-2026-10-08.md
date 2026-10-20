# Audio continuity and listening sessions — 2026-10-08

Refs #88 and #90; Product/device acceptance remains with #85 and W13.
Base: `6e079bad39e1fcd309d5c2906ca930782657f458` (current `dev`, after #247).
Branch: `fix/audio-continuity-and-sessions`. This is a frontend reliability
correction, not a new streaming format or a declaration of pilot readiness.

## Problem and delivered behavior

The audit reproduced an unwanted restart after a failed DAV2 segment: the
full-file recovery replaced the audio element and resumed at zero. It also
reproduced an unusable MSE URL after reselection, a missing same-gateway 503
retry, buffering reported as playing, and repeated signatures with blocked
storage or after a temporary session-capability 503.

The correction keeps DAV2 and the existing key/room boundaries:

1. `useCatalog` owns a selection's MSE URL and cancellation signal. It caches
   complete Blobs only. Recovery reads the outgoing clock just before the
   replacement, then `usePlayback` restores it after metadata and before play.
   Pause/play intent remains owned by playback, so a pause during download
   survives the swap. New selections discard obsolete recovery results.
2. Transport errors no longer call `endOfStream('decode')` while a replacement
   is downloading. HTTP 408/429/5xx retry the same range within the existing
   two-attempt/12-second gateway budget. Authentication errors still terminate
   without a complete-file retry. Full-file body reads now have a 15-second
   inactivity watchdog and cancel with the selection.
3. The player/dock show `Loading audio` or `Reconnecting audio` as appropriate.
   Play intent remains available to Pause during buffering. If both paths fail,
   recovery ends with an explicit failure instead of an endless spinner.
4. `sessionCache` stores identity tokens in memory and, when available,
   localStorage. Its scope includes API URL, address, chain, signature scheme
   and Product public key. Expiry, the 60-second refresh margin, expected-token
   invalidation, disconnect revocation and server per-track authorization remain.
   Pending sign-ins cannot install a session after disconnect.
5. A generic capability 503 fails without a signature and rechecks on the next
   attempt. A missing route or explicit `SESSION_NOT_CONFIGURED` still permits
   the legacy signed path, but negative detection expires after 30 seconds.
   A 503 after SIGN_IN does not immediately ask for another signature.

## Review order and invariants

1. `web/src/hooks/useCatalog.ts`, `features/player/audioContinuation.ts` and
   `hooks/usePlayback.ts`: does only the current selection install a source, is
   the position restored before playback, and can a newer Pause win?
2. `features/catalog/audioV2Gateway.ts` and `readAudioBody.ts`: are attempts and
   inactivity bounded, cancellation cleaned up, and authentication kept out of
   transport recovery?
3. `services/sessionCache.ts` and `keyService.ts`: can a stale 401 remove a
   newer token, can unavailable storage lose the session, and can disconnect
   race with a successful sign-in? No cache entry grants track access.
4. `e2e/audio-continuity.spec.ts`: actual MP3 decoding, AES-GCM, worker, MSE and
   the production hooks are exercised together. The fixtures do not replace
   those boundaries with fake playback state.

The generated 20-second 440 Hz MP3 fixture contains no artist recording. It can
be regenerated with `ffmpeg -f lavfi -i sine=frequency=440:duration=20 -c:a
libmp3lame -b:a 64k web/e2e/fixtures/continuity-tone.mp3` (from a clean fixture
path). Tests encrypt it locally and intercept network requests. Local Blob
URLs must remain readable in WebKit; they are not external network traffic.

## Verification

Final local outcomes: **824/824 unit tests**, **20/20 audio browser regressions**
(10 Chromium + 10 WebKit), and **52/52 existing core browser scenarios** passed.
Web and frozen Product CDM builds passed. Formatting, TypeScript, offline
backlog checks and diff whitespace checks passed. ESLint reported zero errors
and the two existing `App.tsx` dependency warnings; build warnings remain for
bundle size, a dependency annotation and Browserslist data age.

- `npm run test:audio-continuity`: ten scenarios in Chromium and WebKit,
  covering retry, continuity before the first replacement playing event, pause,
  reselection/A → B → A, visible buffering, selection change during recovery,
  corrupted ciphertext, denied key, failed complete-file recovery, and failure
  before metadata without leaving the selection pending.
- Unit regressions cover blocked storage, cache scope, expiry, stale-token
  invalidation, disconnect during sign-in, capability/exchange 503, bounded 401
  refresh, HTTP retries and stalled/cancelled/progressing response bodies.
- Existing core browser flows retain separate coverage of authorized host vs
  walletless guest, denied host, mobile output gating, source replacement,
  startup evidence, room seek/pause and simulated Classic support.
- CI runs the new Chromium continuity suite after the existing core flows.
  WebKit is also run locally; neither browser automation profile is a physical
  Product Host.

Exact final command outcomes and tested implementation SHA are recorded in the
PR. Tests use the normal web `viem` profile explicitly where required; an
operator's exported Product profile must not leak into the Classic mock suite.

## Upgrade and remaining gates

No deployment or transaction was performed for this change. No new environment
variables, API/signaling schema, gateways, dependencies or contract writes.
Old address-only token cache entries require one new protected sign-in because
their API/chain/signing scope cannot be proven. Explicit logout still revokes
readable legacy tokens. Storage-blocked sessions survive track changes, but not
page destruction; no unproven Product persistent-storage API is assumed.

This work does not add a CDN, adaptive encoding, MSE buffer eviction, gapless
playback, or ManagedMediaSource support. Selecting those changes requires the
remaining field measurements. The guest wire protocol still represents host
waiting as not playing, so a remote guest cannot yet distinguish host pause
from host buffering. A complete-file recovery can still take time, but retains
position and has an inactivity bound.

W13/#88 remain open for real devices and an exact deployed candidate: iPhone,
Android, Product Desktop/Web/continuation where supported, Wi-Fi/mobile,
background/foreground, and two-device host/guest recovery. Collect cold/warm
first sound and 30-minute sessions with at least 20 track changes; count
interruptions and unintended timeline resets. No sub-two-second or web2-parity
claim follows from these synthetic tests. Keep guest key requests and
per-track signatures during a valid supported session at zero; spending still
requires an explicit confirmation.

## Post-merge review correction — 2026-10-09

A late review on #248 found that the room-host contribution binding still
collapsed the scoped cache to an address-only lookup. When that address had
fresh sessions for several chains, storage order could select a token that the
contribution server correctly rejected for its configured chain, leaving tips
disabled even though the valid token was present.

The follow-up lookup now requires Dotify's resolved expected chain and the
connected signing identity. Product identities include their sr25519 public
key; extension identities select only the EIP-191 scope. The address-wide
lookup was removed so another caller cannot reintroduce ambiguous selection.
A focused regression creates same-address Product sessions on two chains and
proves that each exact lookup returns its own token while the EIP-191 identity
does not inherit either Product token. Disconnecting the host wallet, losing
the expected chain, finding no exact session, or observing an account/signer
mismatch now emits the empty binding so signaling clears the former recipient.
No API, signaling protocol, environment, deployment, payment, or guest-room
behavior changes.

Follow-up validation passed: `npm run test:unit` (831/831), `npm run build`,
`npm run lint` (zero errors; the two existing `App.tsx` hook warnings),
`npm run fmt:check`, and `git diff --check`.

## Product rollout — 2026-10-09

The merged continuity and scoped-session frontend shipped in Product executable
`[0, 1, 43]` from clean candidate
`c394c2354b128f5bb71cc039142835450ae210f6`, based on tested `dev` merge
`3183de87d4ab90b74e889fae4c317c2b1dc97d2d`. The finalized executable CID is
`bafybeid6izin3sjhmeb7yrslf4snerngjmt4ttt5tsysazf7vju5h3gpkq`. Product host
configuration, Bulletin finality, DotNS content read-back, P2P retrieval and a
public CAR read passed. The CAR contains the exact local `index.html` and the
candidate SHA. The API and signaling services were unchanged.

The real-device W13 boundary remains: this publication does not by itself prove
30-minute continuity, multi-track prompt counts, background recovery or audible
host/guest synchronization on any Product host surface.
