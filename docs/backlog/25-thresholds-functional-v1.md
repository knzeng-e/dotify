# 25 - Thresholds functional v1

## Sprint

Product experience - production-spine presentation and security hardening.

## Priority

P0 entry/listening slice. Later provenance, ambassador, and object work remains
blocked by the production spine and explicit consent/anti-abuse designs.

## Objective

Preserve the functional Thresholds slice while rebuilding its UI from a blank
canvas as `Shared Score` amended by the track-driven Living Light presentation,
without rewriting the proven standalone domain:

- a room share link shows real host, track, and presence metadata before entry;
- `Music` discovers live rooms without waiting for a navigation click;
- the visual hierarchy is a deep listening room lit by real track/artist aura,
  not a dashboard, fake constellation, or restyle of the historical shell;
- paid denial is an honest closed door with no retired 42-percent preview claim;
- the invisible guarantees behind publishing, upload identity, and WebRTC relay
  are hardened and tested;
- artist publishing stays open on the fresh attested deployment and supports
  multi-recipient royalty splits in the release workflow.

Current UI system, information architecture, wireframes, accessibility,
performance, and capability mapping:
[`docs/design/dotify-shared-score.md`](../design/dotify-shared-score.md).
The original product, architecture, security, test, and phased-backlog rationale
remains in the
[`Thresholds blueprint`](../design/dotify-thresholds.md).

## Scope

### Entry and listening

- Load public room summaries when the listener shell mounts.
- Resolve the room targeted by `#/rooms/<roomId>`.
- Present its host, track, real presence count, and room code before entry.
- Preserve the deliberate first-time pseudonym step and remembered-name
  auto-join behavior.
- Preserve the real Socket.IO/WebRTC path and listener no-key invariant.

### Presentation

- Remove the historical stylesheet and the layered `thresholds.css` override;
  load one modular design system with Shared Score structure and Living Light
  presentation as the current visual foundation.
- Replace the rail and four-destination shell with a horizontal desktop header,
  three intentional destinations (`Music`, `Rooms`, `You`), and a contextual
  player opened from a track, room, or persistent player dock.
- Use a deep navy listening canvas, cyan actions, restrained Polkadot pink,
  white-on-blue surfaces, thin score rules, and track/artist aura as the primary
  local colour.
- Retire the redundant `Now` Stage rail in favor of the catalog grid. Keep the
  rooms sky only where it reflects real open-room data, not fabricated activity.
- Keep the finite catalog, real room cards, literal access states, and clear
  empty/error/loading states accessible.
- Retain all load-bearing e2e selectors and behavior.

### Artist publication and value split

- Keep artist runtime creation and release publication enabled only on the fresh
  attested factory/directory.
- The publish form keeps the artist wallet as the primary rights holder and lets
  the artist add collaborators, producers, labels, or other EVM addresses with
  basis-point shares.
- Validate recipient addresses and reject royalty totals over `10000` bps before
  upload/manifest publication/transaction submission.
- Write the full recipient/share arrays to `musicRegRegister`, and reflect the
  total split in the IPFS rights manifest.

### Security hardening

- Runtime-owner-only track registration plus outsider test.
- Server-side BLAKE2b-256 verification of uploaded audio plus mismatch test.
- Chain-domain binding for nonce, signature, session, and key-delivery paths.
- Same-room, verified host-listener authorization for WebRTC relay messages.
- Preserve all three access modes in signaling and remove protected source
  references plus declarative host wallet addresses from public room payloads.

## Acceptance criteria

- A first-time share-link guest sees the host and live track before joining,
  chooses a room name, and enters via `Enter and listen`.
- Live rooms load on `Music` without wallet or key-service activity.
- The deterministic room e2e still proves remote WebRTC audio and zero listener
  key requests.
- No user-facing source says `Preview - 42%` for a locked track.
- An outsider cannot register into another artist's SmartRuntime.
- The artist publish UI can add additional rights holders, rejects invalid EVM
  addresses, rejects splits above `10000` bps, and publishes all recipients to
  the runtime.
- An audio upload whose claimed hash differs from the received bytes is rejected
  before encryption/pinning.
- Wrong-chain credentials are rejected before access checks or key derivation.
- SDP/ICE cannot be relayed cross-room or between unverified participants.
- Public room state contains no protected source ref or host wallet address.
- Lint, unit, signaling, API, contract, build, and e2e checks are green.
- Mobile, desktop, keyboard, reduced-motion, and browser-console smoke checks
  have no blocking issue.

## Non-goals

- Product SDK/TrUAPI/Host adapter implementation.
- Live Proof of Personhood.
- Host reconnect grace, SFU, or Statement Store migration.
- SDP/ICE body schema, byte-limit, and per-peer rate hardening beyond the
  same-room relay authorization delivered here.
- Catalog indexer/API pagination.
- Community/time-bound access facets.
- Provenance, ambassadors, awards, or memory objects.

Those remain sequenced in the design blueprint and must not be implied by the
functional-v1 interface.

## Deployment status

The source-level owner check and outsider regression test are implemented, and
the active Paseo configuration now points to a fresh factory/directory whose
registry facet matches the corrected owner-only `musicRegRegister` source.
Artist publication is open on this active deployment.

Read-only audit at finalized Paseo block `10904607` verified:

- factory: `0x9337287a194dfd8b53939eee1890b3f4ec0f8b0d`;
- directory: `0xda2761fea6f0871ed44ec719860fddb51b115be8`;
- registry facet: `0x76ac102f448fbab9a7ea9efe4450878c01aabc8d`;
- corrected registry code hash:
  `0xa509d4ccc5206974069bb858faba07e42b1f7b9b3fd217adc7bb40a8f714d788`;
- factory/directory pairing: verified;
- finalized runtimes: `0`;
- pending runtimes: `0`.

The previous deployment remains legacy evidence and must not be reused for new
publication.

Read-only audit at Paseo block `10877675` found two finalized runtimes, no
pending runtime, and three existing tracks whose recorded artist and NFT owner
match the runtime owner. Both runtimes remain vulnerable: outsider registration
simulation succeeds and `0xfcb6cd7e` still routes to the old facet.

For existing runtimes, the minimal hotfix replaces only selector `0xfcb6cd7e`
with the corrected facet, preserving the other nine registry routes and all
proxy storage. For future runtimes, the factory is immutable and must be
redeployed; because the current directory's factory assignment is one-shot,
that also requires a new directory and an explicit existing-catalog migration.

Dry-run-first Hardhat tasks now audit the system, fingerprint/deploy only the
corrected facet, generate a state-bound owner plan, simulate the cut, and verify
state plus outsider rejection after execution. See
[`docs/operations/registry-facet-remediation.md`](../operations/registry-facet-remediation.md).

Legacy completion matrix:

- existing runtimes protected: `0/2`;
- existing tracks audited: `3/3` owner-matched;
- pending runtimes found: `0` at the audit block;
- corrected facet deployment: pending explicit approval;
- future factory/directory canary: superseded by the fresh active deployment;
- existing-catalog migration and active cutover: not applied to the legacy
  deployment.

## Delivery notes

The functional slice and source-level hardening are isolated on
`feat/dotify-thresholds-prod-readiness` in PR #92. Shared Score remains the
information architecture and honesty model; the rendered presentation is the
track-driven Living Light layer. Artist publication is open on the fresh active
deployment described above; the legacy remediation work remains documented
separately.

Validation evidence (2026-07-12):

- web lint: 0 errors (3 existing hook-dependency warnings);
- web unit: 136/136, including the fresh-deployment attestation gate, royalty
  split helper coverage, navigation terminology, and
  handler-level proof that unresolved public safety stops writes before
  wallet/upload side effects;
- signaling: 42/42;
- API: 64/64 plus typecheck and build;
- contracts/tooling: 44/44 plus formatting check, including task-level audit
  and finalized-manifest execution, a vulnerable-to-protected one-selector
  hotfix, state preservation, calldata
  shape, and stable plan digest;
- deterministic browser flows: 11/11, including delayed room resolution,
  unavailable links, and guest-entry boundaries;
- production web build and local docs/code whitespace check: passed;
- publication-safety browser smoke and prior Shared Score desktop/mobile/reflow
  no-overflow visual smoke: passed before the final royalty/spacing polish;
- live registry snapshot: completed read-only at finalized block `10904607`;
  the active factory/directory pair, corrected registry code hash, zero
  finalized runtimes, and zero pending runtimes passed the audit;
- corrected-facet deployment task: Paseo dry-run passed; no transaction sent;
- repository diff whitespace check: passed.
