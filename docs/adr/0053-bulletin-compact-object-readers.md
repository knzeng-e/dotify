# 0053 — Reconstruct compact objects through one bounded reader

Date: 2026-11-11. Status: implementation candidate, **not activation**. Refs #407.
Builds on [the graph and journal contract](0052-bulletin-layout-inventory-binding.md).
Exact entry points, limits and failure behavior live in the
[reader reference](../reference/bulletin-compact-reader.md).

## Problem

The fixed compact constructor packs later segments, so existing path readers
cannot retrieve them. Registering that root under the current reference would
make startup appear to work and later playback fail. Downloading an entire
rendition pack to obtain one segment would also defeat bounded mobile delivery.

## Decision

Add internal API and Host object readers before enabling any new reference or
publication selection. Both authenticate the normal manifest and release scope
first. They derive ranges from its encrypted lengths and reconstruct only the
selected logical object. The portable engine checks each visited CID, the fixed
marker, exact stored manifest bytes and UnixFS file/child sizes. Ordinary object
GCM remains the final audio-authentication boundary.

Use one TypeScript range engine in the API source tree, compiled into its image
and imported as source by the Host adapter. It has no imports, Node APIs,
configuration, transport, keys or signer. Each platform supplies its existing
CID/UnixFS/hash implementations through typed codec ports. Keeping the engine
in the existing API compilation avoids a new package/build/distribution step;
the browser must build and test with no API dependencies installed. Duplicating
the range algorithm was rejected because limits and traversal rules could drift.
A deterministic disposable vector binds the constructor and both adapters.

The Host adapter reuses the existing verified block/cache implementation.
Default standard and compact media readers share actual outstanding SDK lookup
accounting, including after a caller aborts. Creating another subscription
budget on every format/session transition was rejected. Caller timeouts cannot
cancel the SDK itself or justify freeing its slot early.

## Persistence and operational boundaries

No profile, queue, route or ordinary player selects this reader. No registered
reference, manifest, ciphertext, key, nonce, admission, budget or durable
inventory format changes. The compact constructor and journal binding remain
byte-compatible. Legacy/public-asset reader regression cases remain required.
The API adapter is not mounted as a public route; its explicit key input does
not replace listening authorization. No service, key or dashboard change is
needed for these internal seams, and this PR performs no deployment or write.

The reader bounds work and copies, but later seeks can still overfetch partial
chunks. Repeated manifest authentication in the API seam is deliberate; a later
request/session cache must preserve exact scope, cancellation and expiry rules.
This candidate does not establish real AAC or physical Host acceptance.

## Remaining gates

The next slice must connect an explicit registered reference to matching
Web/API/Host dispatch and reviewed immutable admission. Never infer the layout
from an old reference or mutate an old claim to opt in. Real-media and legacy
playback, adaptive/seek behavior, Room/background continuity, first sound,
restart/reconciliation and memory acceptance remain before activation.
Synthetic block/wave counts remain planning evidence, not a measured speedup.
