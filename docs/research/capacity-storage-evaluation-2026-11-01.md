# Capacity storage: deferred research

Date: 2026-11-01. Owner decision: **stabilize Bulletin first**. Capacity remains research, not a dependency of the active rollout, a provider switch, or an approved network experiment. Refs #288 (W33).

## Recorded observations

The public [Capacity repository](https://github.com/paritytech/web3-storage) describes the project as an unaudited prototype, not production-ready. Its default `dev` branch was inspected through GitHub's read-only API; the repository reported a latest push on 2026-10-30. SDK/runtime code exists. This is implementation availability, not production service acceptance.

The [network configuration](https://github.com/paritytech/web3-storage/blob/dev/user-interfaces/shared/network-config/src/networks.ts) includes a PreviewNet chain and provider. One anonymous `GET https://previewnet.substrate.dev/web3-storage-provider/health` returned HTTP 200 and `{ "status": "healthy", "version": "0.4.1" }` during this investigation. That snapshot establishes only an answering health endpoint: no storage agreement, provider upload, payment, sustained read, native Host compatibility or availability commitment was tested.

The [design](https://github.com/paritytech/web3-storage/blob/dev/docs/design/scalable-web3-storage.md) and [implementation notes](https://github.com/paritytech/web3-storage/blob/dev/docs/design/scalable-web3-storage-implementation.md) describe provider agreements with capacity, prices and durations, HTTP data operations, replication and challenge mechanisms. Agreement expiration and independent recovery still need management. The [Parity overview](https://www.parity.io/blog/inside-levity-polkadots-decentralized-storage-layer) distinguishes this direction from Levity, which combines Bulletin and HOP. Dotify currently integrates Bulletin directly.

## Reopening criteria

Revisit after the Bulletin publication and conservation spine is accepted, or if measured Bulletin capacity, authorization continuity or cost makes a separate comparison necessary. Refresh upstream status first. A later approved synthetic canary should establish agreement admission, exact encrypted-byte retrieval, actual prices/durations, provider failure/replica recovery and Web/Host transport compatibility. Existing Bulletin authorization does not authorize or configure Capacity; native Bulletin preimage retrieval is not automatically a Capacity reader.

This note creates no new service, account, subscription, budget, authorization, signer installation, upload or implementation commitment. Preserve the current encrypted format, artist-controlled rights and canonical key checks if research is resumed.
