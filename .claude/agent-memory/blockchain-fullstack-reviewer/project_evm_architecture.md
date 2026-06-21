---
name: evm-architecture
description: EVM contract architecture for Dotify — diamond/pallet system, dual registry, security boundaries, and key access-control patterns
metadata:
  type: project
---

Diamond proxy system: SmartRuntime.sol is an ERC-2535 diamond. Storage slot is keccak256("dotify.contract.storage"). Each artist gets their own SmartRuntime deployed by ArtistRuntimeFactory. Seven pallets are shared implementations: DiamondCutPallet, DiamondLoupePallet, OwnershipPallet, MusicRegistryPallet, MusicNFTPallet, MusicRoyaltiesPallet, MusicAccessPallet.

ArtistDirectory is the global artist->runtime index. Factory is the only authorized writer (set once by deployer).

DotifyRuntimeInitializer sets personhoodRegistrar = contractOwner (the artist) at runtime bootstrap via delegatecall from SmartRuntime constructor.

Access policy view function: MusicAccessPallet.musicAccCanAccess(bytes32 contentHash, address listener) — this is the on-chain query the backend key service should call for wallet-signed content-key requests (Ticket 03).

Dual registry situation: MusicRightsRegistry.sol is a standalone (non-diamond) monolithic contract that duplicates all pallet functionality. It is the legacy prototype. The pallet system is the production path. Both are deployed and tested but only the pallet system should be used going forward.

Key security boundary: personhoodRegistrar is owner-gated for rotation, registrar-gated for setting levels. This is correct. No cross-artist contamination: each SmartRuntime has its own namespaced storage slots.

Known issues (from 2026-06-11 review):
- musicRoyPayAccess has no reentrancy guard and no already-paid guard — reentrant recipient can drain double payment on the same call
- musicRoyPayAccess does not refund overpayment; excess msg.value beyond pricePlanck is permanently captured
- lastPos == 0 in LibDiamond._unregisterSelector is wrong condition for facet cleanup; should be (facets.length - 1 == 0), which it is after the pop — actually the logic checks length - 1 before the pop, so when facet has exactly 1 selector lastPos == 0 is correct. Confirmed: not a bug.
- DiamondCut event is emitted BEFORE the init call runs (LibDiamond:96 vs :97) — event consumers see a cut before its init side-effects execute
- ArtistDirectory constructor/setFactory/register are marked payable without need
- No royalty update path — splits are locked at registration; this is intentional per design
- MusicRightsRegistry.sol is dead code relative to the pallet system — should be removed or clearly scoped to legacy
- No test coverage for: reentrancy on musicRoyPayAccess, overpayment capture, double-payment idempotency, deactivated track transfer attempt, NFT approval flows

**Why:** Recorded from full contract review on 2026-06-11.
**How to apply:** When working on Ticket 03 or any payment/access path, these gaps are the highest-priority pre-production blockers.
