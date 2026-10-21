# Product 0.1.58 streaming reset rollout

Status: prepared, rollout in progress on 2026-10-22. No acceptance claim.
Refs #317, #287, #320. Application source: `142fc63260c0a8e390fa5da08dd03664c0d30752`
(merged #321), green Dev Quality Gates run 39686042681.

## Coordinated boundary

This executable packages authenticated v3 streaming and the fresh factory
`0x708d35eee7c1416f6d332344068be9d714aec24c` / directory
`0x8e611ef60169f8ed93019de4a3034a504ae2ad29` on chain 420420417.
It retains product-cdm/devnet, frozen empty bootstrap and existing permissions.
The retired catalog and legacy codecs are not a rollback target.

Deploy the non-root API storage migration, private encoder and streaming custody
initialization before clients. Preserve session epoch, key custody, contribution
history and the permanent nonce ledger. Follow the streaming publication and
non-root storage runbooks; do not wipe the volume.

## Remaining gates

Record live image digests, volume backup, byte-preserving maintenance, UID/GID,
API and signaling identities, public client bytes, finalized DotNS and public
CAR readback after execution. A fresh artist runtime, real publication and
physical Web/Product listening, access and room checks remain acceptance gates.
