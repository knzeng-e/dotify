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
- `VITE_BULLETIN_WS_URL`
- `VITE_PINATA_JWT`
- `VITE_PINATA_GATEWAY`

See `.env.example` for local defaults and script-only variables.

Audio files, cover images, and artist contract PDFs are stored in browser
`localStorage` for the current POC. Audio is encrypted before storage, and the
player decrypts it from the stored ciphertext at playback time.

Pinata stores audio, cover, and metadata JSON on IPFS. Bulletin Chain
interactions use the PAPI descriptors in `.papi/` and can publish the compact
metadata JSON hash as an additional on-chain availability layer. Regenerate the
descriptors with `npm run update-types && npm run codegen` if the target chains
change.

The current POC calls Pinata directly from the browser. Use a restricted JWT for
local demos; production should move pinning behind a backend proxy.
