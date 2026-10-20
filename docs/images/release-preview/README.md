# Current interface captures

The root README and public project page use this gallery. It replaces the old
README images; historical screenshots referenced by dated design/evidence
documents are retained at their original paths.

## What these images show

These are browser captures of the application UI, not painted mockups. They use
local, synthetic releases by **Mina**, generated cover artwork and six local
browser sessions across three concurrently open rooms. Two rooms opt into
Worldwide discovery; one opts into Nearby. Their connected counts are 2, 3 and 1,
including hosts. The real local signaling server carries room/chat and presence
flow. The gallery is a visual introduction, not evidence of live attendance,
payments, physical audibility or native Product support.

No real wallet, participant, source key, external catalog, location service or
upload is used. The displayed location is a browser-emulated test fix. The
documentation server supplies synthetic registry reads for those three releases
so discovery uses their covers through the normal metadata path. It rejects
unknown reads and has no signer. No verified artist-presence badge is fabricated.

| File                 | Surface                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `music-desktop.jpg`  | Catalog with three local demonstration releases.                                                             |
| `rooms-desktop.jpg`  | Three parallel Nearby/Worldwide rooms with covers, orbiting presence and distinct real local session counts. |
| `room-desktop.jpg`   | Guest's shared player and conversation.                                                                      |
| `room-mobile.jpg`    | The same guest room at a 390 × 844 browser viewport.                                                         |
| `artist-desktop.jpg` | Artist studio's Releases view.                                                                               |

`capture.json` records the application source/tree, capture profile, time and browser.
Artworks are served locally at their synthetic content-addressed paths; nothing
is pinned to a public gateway. JPEG
quality 85 keeps the gallery small; images have not been manually retouched.
The mobile image is browser emulation, not a screenshot from a physical phone.

## Reproduce

With Node 22 and npm 10+, from the repository root:

```sh
npm ci --prefix web
cd web
npx playwright install chromium
npx playwright test --config playwright.docs.config.ts
```

The dedicated configuration starts local Vite/signaling at ports 5340/8796 and
uses existing browser adapters plus a documentation-only registry fixture.
External HTTP requests are blocked by the capture contexts. The recipe is excluded from the ordinary browser suite and
does not introduce a production feature flag or change application code.
Do not use `VITE_E2E_*` settings in a published build.

Before replacing the gallery, inspect every output at desktop and mobile
sizes. Wait for messages and selected views to settle, preserve the demo
disclosure, and update the dimensions in `docs/index.html` if they change.
Keep release acceptance in the
[pilot evidence](../../backlog/implementation/evidence/), separately from these
illustrations.
