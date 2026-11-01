# ADR 0042: read the same Bulletin ciphertext in Host and Web

- Date: 2026-11-01
- Status: implemented for review; production publication and rollout remain gated
- Scope: W33 / #288, with W32 / #287

## Decision

Connect the ordinary authenticated player to Bulletin. The registered v3 audio
reference retains its existing shape; its BLAKE2b-256 directory CID identifies
the Bulletin path. Product loads the native reader lazily, asks Cloud Storage
for raw preimages, verifies every block hash and follows only the requested
manifest/init/segment path. It does not request a reassembled whole directory.

Ordinary Web uses the existing catalog-gated `/api/media/:cid/stream/*` route.
An optional server-only `BULLETIN_MEDIA_RPC_URL` selects a public HTTPS origin.
The adapter permits only genesis lookup and raw block retrieval, pins the
DevNet genesis and authenticates every returned CID before reconstructing an
object. No additional hosting service, RPC SDK or browser signer is introduced.
Host failure can recover through this same API; Bulletin roots never spend
retry time against unrelated Pinata/edge origins. Caller cancellation cannot
start recovery work. An unconfigured API returns an explicit unavailable error.

The player still obtains a key through the existing canonical release/access
service, authenticates the manifest and decrypts each selected segment. A CID
or a successful ciphertext response grants no access. Only a room host receives
the key; guests still receive the ephemeral room stream. Keys and plaintext
never enter either transport cache.

## Bounds and trust

Both readers retain at most 32 verified raw blocks / 2 MiB for 30 seconds.
The existing player adds its bounded short-lived ciphertext object cache. Each
path walk permits 16 reads, eight file levels, 512-KiB raw blocks and an object
ceiling of 1 MiB + 16 bytes (manifest: 256 KiB at the API/player boundary).
Archive paths, arbitrary URLs, query strings and ranges remain excluded.
The API rechecks active catalog membership before every response, including a
cached response. Its network reads have 10-second deadlines inside a 12-second
whole-object limit; invalid/oversized RPC envelopes and blocks fail closed.

The installed Host SDK has no external lookup cancellation input. The caller
can stop waiting, but the adapter counts each actual SDK promise until it
settles and admits at most two outstanding lookups. Repeated aborts therefore
cannot accumulate native subscriptions. Its lookup, Host detection and object
waits are bounded at 10 seconds, 1.5 seconds and 12 seconds respectively.

The operator selects a trusted public RPC origin. Genesis is a network check,
not a light-client proof; block hashes and AEAD authentication protect the
returned content, not availability, retention or RPC honesty about chain state.
The endpoint is never supplied by a listener or forwarded with credentials.

## Alternatives and rollout

A browser-direct Bulletin RPC would avoid the API relay but depends on public
RPC CORS/capacity and adds another browser trust/configuration path. The existing
API already owns catalog admission, cancellation and response limits. A separate
gateway service would add hosting/operations without evidence that it is needed.
Reusing the Host's default whole-directory reassembly would delay first audio
and fetch unneeded renditions and the archive.

During internal development the target is a fresh Bulletin catalogue/runtime
deployment, as requested by the owner. Existing SHA-addressed delivery keeps the
currently deployed app working until that coordinated switch; this decision
does not introduce permanent old-runtime compatibility or a migration framework.
The existing publication worker is still configured for Pinata. Selecting its
Bulletin writer requires separately reviewed persistent custody, runtime-bound
key scope, storage allowance and a real protected Web/Desktop/mobile test.
This PR neither changes live configuration nor publishes artist content.

Rollback before activation is the preceding bundle with the RPC origin unset.
After registering Bulletin releases, keep a compatible reader available or
coordinate a fresh catalogue/runtime switch: removing the reader alone would
make those references unavailable. No storage deletion or renewal is automatic.

See [application/readback evidence](../backlog/implementation/evidence/bulletin-application-readers-2026-11-01.md).
