# Dotify Web

React frontend for Dotify, a decentralized shared-listening experience built
around real-time rooms, artist catalog management, and track NFT rights.

Visible product areas:

- `Home`: catalog browsing, track artwork, descriptions, access badges, player,
  and room hosting.
- `Rooms`: open room discovery and room-code entry.
- `Artist Studio`: audio upload, cover upload, artist contract PDF upload,
  local asset references, Bulletin Chain JSON manifest publication, Human free /
  Classic mode selection, and contract registration.

```bash
npm install
npm run dev:listen
```

The script starts Vite at `http://localhost:5273` and the Socket.IO signaling
server at `http://localhost:8788`.

Useful environment variables:

- `VITE_SIGNAL_URL`
- `VITE_LOCAL_WS_URL`
- `VITE_LOCAL_ETH_RPC_URL`
- `VITE_DOTIFY_EVM_CONTRACT`

Audio files, cover images, and artist contract PDFs are stored in browser
`localStorage` for the current POC. Audio is encrypted before storage, and the
player decrypts it from the stored ciphertext at playback time.

Bulletin Chain interactions use the PAPI descriptors in `.papi/` and publish
only a compact JSON manifest that points to the local POC assets. Regenerate the
descriptors with `npm run update-types && npm run codegen` if the target chains
change.

Durable IPFS/pinning storage is intentionally deferred to the roadmap so the app
can validate the encrypted-rights flow without an upload backend.
