---
name: project-context
description: Dotify/Muzinga project overview - Sprint 0 active, architecture, security boundaries, key design decisions
metadata:
  type: project
---

Dotify is a decentralized cultural social hub: music as shared presence, not streaming. Artist-owned smart runtimes on EVM (Polkadot Asset Hub testnet), IPFS/Pinata for encrypted audio, WebRTC for room streaming, Polkadot Bulletin Chain for manifest archival.

**Why:** Production spine goal (Sprint 0), not adding features. Ticket 03 (wallet-signed content-key requests) is the active ticket.

**Stack:** React/Vite frontend (web/), Fastify backend (services/api/), EVM contracts (contracts/evm/), Polkadot Substrate integration via @polkadot-apps packages.

**Key security boundary decisions:**
- VITE_PINATA_JWT is bundled in the browser in demo mode (intentional, documented as demo-only). When VITE_DOTIFY_API_URL is set, uploads go server-side.
- VITE_CONTENT_SECRET (for AES-256-GCM audio encryption) is also bundled in the browser - the code explicitly documents this as "best-effort, not DRM". The all-zero fallback key is the dev default.
- devAccounts (Alice/Bob/Charlie from the standard Substrate dev phrase) are used as fallback Bulletin signers when no wallet is connected. This is a known dev-mode path.
- EVM private key derived from WebAuthn PRF extension output via KeyManager.fromRawKey. Lives only in memory.

**Architecture snapshot (as of 2026-06-11 review):**
- App.tsx: 867 lines, flagged monolith. Contains file handlers (handleAudioFile, handleCoverFile), navigation, 12+ useEffect hooks, release form state, and bridge functions between catalog/session hooks.
- Three giant hooks: useSession (613 lines), useCatalog (602 lines), useArtistConsole (632 lines). Each exports a large flat return object including refs.
- useSession exposes all internal refs (socketRef, hostPeersRef, listenerPeerRef, etc.) to App.tsx - unnecessary coupling.
- useCatalog owns decryption, preview logic, payment flow, and on-chain registry reading.
- useArtistConsole owns artist registration, rights registration, royalty reading, Bulletin upload.

**Honesty rule violations found:**
- ArtistProfileView.tsx:63 - `followerCount` is fabricated: `1200 + artistName.length * 137 + artistTracks.length * 4300`
- Presence.tsx:41-46 - `roomPresenceNames()` generates fake names from PRESENCE_POOL; the comment says "only the listener count is real". Used in ListenView, RoomsView, ArtistProfileView room cards.
- Follow button (ArtistProfileView.tsx:59,99) has no backend - `isFollowing` is local state only, no persistence.
- ListenView.tsx:48 shows "{totalListening} listening together now" - this is real (derived from socket openRooms) but displays even when socket is offline.

**How to apply:** When reviewing future PRs, these are the known pre-existing issues. The fabricated followerCount and follow button are the most user-facing honesty violations.
