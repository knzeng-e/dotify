# Protected listening without per-track signatures — 2026-10-09

Refs #90 and access model v2/P2. Base: `5dc24d3` (`dev`, after #251).
Branch: `fix/session-only-listening`. This changes the frontend session/key
client; it does not deploy the app or establish physical Product acceptance.

## Delivered behavior

- Protected key requests carry only a scoped session token. The current
  frontend cannot fall back to a REQUEST_CONTENT_KEY wallet signature.
- Missing/unconfigured sessions fail before approval. An established token
  survives network, 503 and ambiguous 401 failures. Only typed expiry,
  revocation or API restart allows one renewal.
- A rejected renewed token or an exchange interrupted after wallet approval
  latches that signing scope in memory. Subsequent playback retries do not
  sign. Explicit sign-in or disconnect/reconnect clears the latch; the playback
  feedback explains the recovery. Declining the initial wallet prompt remains
  an explicit refusal and does not authorize anything.
- HTTP requests have a 15-second timeout, excluding wallet approval. Scoped
  memory/storage reuse, TTL, revocation and disconnect races remain enforced.

The server remains authoritative for each key's track-access decision. It
still accepts legacy signed requests from older clients; this frontend never
uses that route. Free tracks and guest room listening need no login. Payments
retain their separate consent. API restart deliberately invalidates sessions;
this work does not add a durable session/revocation store.

## Validation and boundaries

837 unit tests pass. Focused tests exercise an EIP-191 WalletClient and Product
signer across twenty distinct key requests with one signature, including a
key-service 503; missing session capability makes zero signatures; ambiguous
401 preserves the token; typed revocation renews once; repeated rejection and
failed post-signature exchange cannot loop prompts; explicit sign-in recovers.
Existing storage-blocked reuse, logout, concurrent sign-in and disconnect
race coverage still passes. Build, TypeScript, formatting and lint pass with
the two existing App.tsx hook warnings.

No funded action or deployed device test was performed. The twenty-track
check is deterministic client/API evidence, not a physical-wallet measurement.
Before rollout verify GET/POST session auth and token-based keys on the target
API, then count prompts over twenty protected tracks in browser and Product.
Sessions expire after 24 hours, refresh shortly before expiry, and are revoked
by disconnect/API restart. Storage-blocked sessions survive only in the page.
An interrupted login latch is page-local and holds no signature or content key.
