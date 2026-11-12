# Compact Bulletin object readers

Status: bounded reader implementation for #407. Ordinary selection now requires
the [explicit compact reference and exact admission](bulletin-compact-delivery.md).
Existing references and live publications keep their standard layout; this
reference grants no publication authority.
[Decision](../adr/0053-bulletin-compact-object-readers.md) ·
[Acceptance evidence](../backlog/implementation/evidence/bulletin-compact-readers-2026-11-11.md).

## Entry points and authority

| Entry point                                 | Contract                                                                                                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API `readAuthenticatedCompactObject`        | Receives exact manifest bytes, a trusted release key/scope, root, logical object path, byte limit and cancellation signal. Authenticates before reading blocks. Returns ciphertext, not clear audio. |
| Host `createBulletinHostCompactMediaReader` | Prepares a session by authenticating a copied manifest with the ordinary browser verifier. Returns the verified context and a bounded `read(path, maxBytes, signal)` method.                         |
| Portable `readCompactBulletinRange`         | Internal algorithm called by those adapters. Receives the locally derived range and platform codec ports; it is not a public offset API or a key-delivery endpoint.                                  |

The API adapter lives in
[`bulletinCompactReader.ts`](../../services/api/src/services/bulletinCompactReader.ts),
the Host adapter in
[`bulletinCompactMedia.ts`](../../web/src/features/catalog/bulletinCompactMedia.ts).
The Host caller must obtain its key through the existing access boundary. The
public API may derive a retained key internally solely to authenticate
catalogue-selected ciphertext, as specified in the
[delivery contract](bulletin-compact-delivery.md#ciphertext-delivery). Preparing
a reader grants no entitlement, Room membership or storage allowance.

The marker is the fixed [ADR 0052](../adr/0052-bulletin-layout-inventory-binding.md)
`rendition-pack-v1` contract. Init and segment zero stay standalone. Later
ciphertext objects are concatenated in rendition order in `pack.bin`. Their
positions come from the authenticated ordinary manifest's encrypted lengths;
there is no network-provided offset table. The archive cannot be selected.

Each read verifies the visited block CIDs, the exact marker and that the root
contains the **same manifest bytes** authenticated by the adapter. A semantically
similar reserialization is not interchangeable with those bytes. Returned
ciphertext still needs ordinary per-object AES-GCM authentication/decryption;
a valid graph hash alone is not proof of valid audio.

## Bounds

Limits are defined in the
[portable engine](../../services/api/src/services/bulletinCompactRange.ts) and
[Host block adapter](../../web/src/features/catalog/bulletinHostMedia.ts).

| Resource                                | Bound                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| Logical paths                           | Qualities 96/160/320; `init.bin` or `segment-000.bin` through `segment-255.bin`        |
| Returned object                         | Positive integer maximum of 1 MiB + 16 bytes; complete requested encrypted object only |
| Manifest input                          | At most 256 KiB, copied before asynchronous work                                       |
| Layout descriptor                       | At most 4 KiB; exact fixed marker, no extra fields                                     |
| Compact chunk                           | 256 KiB                                                                                |
| Total selected pack                     | At most 132 MiB, checked against authenticated lengths and UnixFS metadata             |
| Distinct fetched blocks per object read | 16, with a per-read verified-block cache                                               |
| Accepted fetched bytes per object read  | `maxBytes + 2 × 256 KiB + 320 KiB`, including descriptors and DAG metadata             |
| File recursion depth                    | 8, with root depth 0                                                                   |
| Range extraction deadline               | 12 seconds                                                                             |
| Host availability probe                 | 1.5 seconds before extraction                                                          |
| Actual outstanding SDK lookups          | At most 2 per shared media block adapter, until each SDK promise settles               |
| SDK lookup                              | `noReassemble: true`, `lookupTimeoutMs: 10000`; local wait also bounded                |
| Host verified-block cache               | At most 32 entries / 2 MiB, 30-second lifetime                                         |

The byte allowance includes partial-chunk overfetch. It is checked after each
bounded block arrives; a failed read can receive one additional block of up to
512 KiB before refusing. An invalid oversized SDK response is rejected, but the
caller cannot prevent allocation inside the SDK itself. This is not a bandwidth or
latency improvement claim. The reader skips nonintersecting children instead
of materializing the pack. Decoded metadata and copied slices still consume
memory; hosted pressure and real-media seek/start behavior need acceptance.

## Cancellation and failure

A Host prepared session captures its original root and owner signal. Changing
the caller's input object cannot replace that binding. Aborting the owner
permanently cancels further reads; an individual read can also be cancelled.
Outside the Host, `read` returns `null` without querying the SDK. The adapter
itself does not try an HTTP gateway or silently select a different format.

The SDK's underlying lookup cannot be cancelled by the caller. Cancelled or
locally timed-out reads therefore keep their actual SDK slot until settlement.
The default compact and standard media adapters share that budget/cache; a
format transition cannot create a second independent media budget. The existing
public-asset adapter keeps its separate budget. Late cancelled results do not
enter the cache or resume reading. A busy adapter refuses rather than creating
more subscriptions; it admits work again when an actual lookup settles.

Malformed paths, markers, CID bytes, file sizes, child-size counts, depth or
bounds fail closed. A readdressed altered ciphertext may pass graph validation
but must fail ordinary object GCM. The [delivery contract](bulletin-compact-delivery.md#ciphertext-delivery) maps
these failures at the catalogue-gated HTTP boundary.

## Acceptance still required

[Explicit reference/dispatch and immutable admission](bulletin-compact-delivery.md)
connect these seams without reinterpreting old references. Real AAC startup,
seeking/adaptation, Room/background behavior, recovery/rollback, first sound and
memory on intended Hosts still need acceptance. A compatible deployment and any
funded trial require their own reviewed operational plan; merging code is not
activation.
