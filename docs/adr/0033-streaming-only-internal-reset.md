# ADR 0033: one audio format after the internal catalog reset

Status: accepted by owner direction, implementation under #320.
Date: 2026-10-21.
Supersedes the compatibility and catalog-migration portions of ADR 0032.

## Decision

Dotify is still in internal testing. The owner will retire the existing test
releases and start with fresh artist runtimes. Keeping two complete encryption,
transport and playback stacks would preserve debt for data that is deliberately
being abandoned. Published audio now has one format: `dotify:enc:v3:key-vN`,
where N is at least 2, identifying an authenticated streaming directory.

Old packed ciphertext, DAV2 containers, range decryption/recovery, hash-only
keys and browser demo audio encryption are removed. No catalog re-encoding or
transparent old-reference upgrade is offered. Unsupported references fail
closed; artists republish from the original master.

The supported non-MSE reader is retained because it authenticates and assembles
the _same_ AAC rendition on devices without standard AAC MSE. It is not an old
codec fallback, and the playback reader cannot select the archival master.

## Boundaries

ADR 0032's v3 wire authentication, exact release binding and high-counter nonce
namespace remain unchanged. Existing v2 release-bound HKDF bytes also remain
unchanged. Key rotation is an ongoing security need, not legacy compatibility.
Keep all usable-key nonce reservations even when the catalog resets: redeploying
contracts does not make old nonces safe to reuse under the same actual key.

Audio upload requires the server job/encoder path. A missing worker returns
503; a failed encode can be retried from durable state but cannot silently
produce another format. Ciphertext transport may try reviewed gateways after
network/truncation failures; a correctly sized object with bad authentication
is terminal. A small bounded manifest/init ciphertext cache never stores keys
or clear audio, and never grants playback authority.

First-sound exports become schema 6 with current manifest/segment telemetry.
Schema 5 exports remain historical records and are not imported or relabeled.
AAC Blob usage is descriptive, not a failed DAV2 fallback percentage; both
readers remain subject to physical first-sound/access/continuity acceptance.

## Operational consequence

Merge/deploy the fresh-directory configuration and matching API/Web/Product
versions together. Recreate artist spaces and publish new releases. No old
catalog rollback is promised by these clients. This source change performs no
live deployment, deletion or custody rotation. For outages retain current-format
clients and custody, pause publication and restore the reviewed encoder/state.
