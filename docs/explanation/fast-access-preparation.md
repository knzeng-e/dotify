# Preparing access before the next track

W34 (#289) prepares access for the current v3 streaming format. It does not
introduce another format, change key derivation or grant access from catalog
labels. A signed session proves identity; the artist runtime still decides access.

## Server authority and lifetime

For each release the API first checks the full supplied identity against its
fresh, confirmed catalog. The [A09 authority policy](../reference/finalized-key-authority.md)
requires valid finalized and current block observations, then positive directory,
release and access checks at both exact canonical hashes. This conservatively
waits for final settlement of new access while respecting newer revocations.
Coincident block identities share one proof. `ACCESS_PENDING_FINALITY` asks the
listener to retry without another payment; unsupported finality fails closed.

The service retains at most 512 verdicts in process memory, not keys. Both policy
allows and denials expire within 30 seconds from the start of verification. Cache
identity includes chain, directory, requester (zero address for Free), purpose,
full canonical release and both observed block numbers/hashes. Changing either
block misses the cache. Catalogue freshness and both observations are checked on
a hit; RPC failures are not cached. Overlapping requests share block observations
and identical in-flight proofs without extending their original expiry.

The configured public RPC accepted a read-only EIP-1898 probe on 2026-10-25;
that dated wire check does not validate A09 finalized-tag semantics or a native
Host. Exact provider acceptance remains before matching delivery.

`POST /api/tracks/keys/prepare` accepts an existing `sessionToken`, purpose
`individual` or `room_host`, and one to five complete track identities. It never
accepts a caller-selected requester or room-listener purpose. After parallel
per-track checks it verifies the session again, so expiry or logout during RPC
work prevents key derivation. The response lists allowed keys and ordinary
per-track denials; errors and all replies carry `Cache-Control: no-store`.
The response expiry cannot extend the oldest allowed cached verdict.

Dedicated limits are 12 batch requests/minute and 30 Free-key requests/minute,
using the W30 real-client resolver and separate route buckets. A batch authorizes
at most five tracks. Individual key delivery remains the ordinary cold fallback.

## Playback ownership

Once audio is advancing with sufficient buffered headroom, the existing
neighbour-prefetch hook prepares up to five queued/adjacent releases. It respects
background, offline, data-saving, stalled and paused states. It refreshes at most
once per 20 seconds while eligible, refreshing grants with at most ten seconds
remaining while retaining a usable grant during that refresh. Server verdicts
near expiry are also rechecked rather than extending an old result. Speculation reuses a session and never opens
or renews one, prompts a wallet, or changes the currently playing source. A room
guest never enters this host-only path.

Prepared keys are bounded to five, held only in page memory and bound to the
exact account, chain, signing identity, session token, purpose and full release
identity. Their lifetime is the lesser of server expiry and 30 seconds from the
batch request start. A prepared Next bypasses the redundant client policy probe
and key HTTP request; actual AEAD manifest/media authentication still runs.
Expired/missing/denied preparation uses the ordinary checked playback path.

Sign-out and wallet identity/network transitions clear the prepared cache.
Cancellation and generation checks stop late responses from restoring it. The
old unscoped, indefinite `useCatalog` content-key map is removed. Identity tokens
can still use the existing session store; content keys never go to browser
storage, a worker, CDN, URL or service worker. An already delivered key or audio
cannot be cryptographically revoked; this is distribution access protection,
not DRM. Previously started playback is not retroactively interrupted by a
cache expiry.

## Delivery and measurement

Deploy the API before the Web/Product clients. Older clients retain the single
key routes. Before the API upgrade a missing batch route simply leaves Next on
the existing cold path; speculation never switches to per-track signing.
No new environment variable, permission, secret, database or contract is needed.
Rollback the client first, then API if needed, preserving all custody/session
files. A restart clears verdicts only.

The local benchmark measures key waiting with a simulated API delay, not real
first sound. Physical Web/Product, cold/warm network measurements and the
existing W13/#88/#287/#317 acceptance matrix remain release gates. Gapless,
adaptive playback and system media controls are the separate W35 (#290).
