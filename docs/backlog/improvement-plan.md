# Dotify strategic improvement plan (July 2026)

Tracked outcome of a full review of the implementation against the product
memory, technical memory, philosophical north star, and the current
Polkadot/Parity product direction Dotify claims: artist sovereignty,
permissionless architecture, Product SDK host capabilities, Playground /
Bulletin / DotNS deployment, Statement Store presence, and
Humanity/Individuality.

This plan does not change the production readiness rule: the spine finishes
first. It exists so the differentiating work after the spine is deliberate,
tracked, and does not drift into ornamental features.

## Review verdict (summary)

What holds up: incremental behavior-preserving refactors with an e2e net,
tested feature modules, documented security boundaries that do not overpromise
DRM, the dev-signer fail-closed guard, access model v2, the host-based room
doctrine (guests join with a link alone), chat/reactions over the current relay,
and the merged Shared Score / Living Light functional slice.

Where it falls short of its own standards:

1. The social core has a first layer, but the resilient version is not done:
   hosted signaling still centralizes discovery/relay, rooms remain one-host,
   and TURN/SFU/reconnect/handoff policy is unresolved.
2. The killer differentiator is still mocked. Human-free access gated by real
   Humanity / Individuality verification remains a dev-operated registrar path.
3. Product SDK alignment is real but not implementation-ready: the SDK is
   prototype/reference/unaudited, Host features require a compatible container,
   current contracts target PolkaVM/CDM via `pallet-revive`, and only Paseo /
   Summit presets are live.
4. The standalone production path still needs first-sound operation evidence:
   gateway behavior, DAV2 Range/MSE validation, and the backend read-through
   decision. Backend readiness, hosted signaling, wallet/device checks, and
   deployment smoke tests are now records.
5. Frontend debt is now concentrated in large domain hooks and player/session
   flows, not `App.tsx`. ABI generation is delivered and must stay checked.
6. UX gaps against the "invisible trust" bar: first sound still depends on
   catalog/gateway behavior, Product-host permission failures need explicit
   copy, and overlapping operations need better local feedback.

## Now - finish the standalone production spine

| Item | Tracking | Status |
| --- | --- | --- |
| PR8b providers/context boundary (5 stacked PRs) | `08b-providers-design.md`, tracker rows 8b-1..8b-5 | Delivered on `main` |
| PR9 `shared/` tree relocation | `08-frontend-refactor-tracker.md` | Delivered on `main` |
| PR10 split mega-hooks (`useCatalog`, `useSession`, `useArtistConsole`) along their `features/*` seams | follow-up rows in the ticket 08 tracker or a new focused refactor ticket | Proposed |
| Generated ABI bindings | `09-generated-abi-bindings.md` (#10) | Delivered |
| Observability and health checks on the key service | `10-observability-health-checks.md` (#11) | Delivered; residual DAV2/gateway evidence moved to #88 |
| Separate production preview assets | `18-production-preview-assets.md` (#27) | Retired by access model v2 |

## Next - standalone operation and listening depth

| Item | Tracking | Status |
| --- | --- | --- |
| Public API/signaling operation evidence: readiness checks, frontend health surface, public env validation, CORS/origin hardening, unsafe-secret guards, and deployment smoke checks. | #11, #36, #37 | Delivered / Record |
| DAV2 validation: real browser/container/gateway matrix, Range + MSE fallback behavior, first-sound metrics, and decision on backend read-through gateway. | #87, #88, `24-access-streaming-v2.md` | Active |
| Room resilience: short-lived TURN credentials, reconnect/handoff policy, and optional SFU only when it protects the link-first guest doctrine. | #89 | Active |
| Value-before-wallet onboarding: make public room links and first sound useful before asking for wallet state, while keeping protected source access fail-closed. | #90 | Active |

## Product SDK feasibility track

This track runs in parallel with standalone hardening, but it does not block
first sound and must not be sold as a delivered capability.

Product SDK snapshot used for this plan:

- `paritytech/product-sdk@2f359bba28ca72855207a0a519d4118b37b4438c`
  (fetched 2026-07-14);
- `@parity/product-sdk` 0.17.0;
- explicit prototype / reference / unaudited status;
- live preset environments: Paseo and Summit;
- contracts package: `pallet-revive`, PolkaVM artifacts, and CDM manifests;
- Statement Store: 512-byte statement payload, 1024-byte user total, default
  30-second TTL.

| Item | Tracking | Status |
| --- | --- | --- |
| Product SDK baseline: pin SDK versions, document compatible Host surfaces, and add feature detection for Host local storage, signing, permissions, resource allocation, payments, and chain support. | #85, `polkadot-product-readiness-and-killer-dapp-roadmap.md` | Proposed |
| Contract portability spike: compare Dotify's current Paseo Asset Hub EVM / viem / Hardhat flow with Product SDK contracts on `pallet-revive`, PolkaVM artifacts, and CDM manifests. | #85 | Proposed |
| Playground deployment spike: determine whether Dotify's static build can use Playground/Bulletin/DotNS deploy flows without weakening current secret and publication boundaries. | #85 | Proposed |
| Statement Store presence spike: use it for small, signed, ephemeral discovery/presence only. Do not move SDP/ICE, full chat history, media metadata, or link-only guest reactions there until signer, TTL, and size constraints are solved. | #89, `20-room-social-layer.md`, `21-room-collaborative-queue.md` | Proposed |
| Humanity / Individuality research rewrite: prove the canonical live source, privacy-preserving proof shape, product-account/identity-account binding, and fallback UX before promoting Human free from research to build. | #12, `11-proof-of-personhood-integration-research.md` | Open |

## Later - concept and cultural propagation

| Item | Tracking | Status |
| --- | --- | --- |
| Rooms as an actual village square: provenance trails showing which room and host introduced a listener to a track, as the substrate for the ambassador model without referral mechanics. | `12-ambassador-social-propagation-model.md` (#13); collaborative queue delivered in `21-room-collaborative-queue.md`; reactions/chat delivered in `20-room-social-layer.md` | Provenance and consent still proposed |
| Aura-driven discovery: browse rooms and tracks by light and mood rather than lists. | new ticket | Proposed |
| Key-delivery decentralization path: documented route away from the single `CONTENT_KEY_MASTER_SECRET`, for example per-artist key derivation anchored to the SmartRuntime or threshold key shares across independent key-service instances. | new ticket | Proposed |
| UX polish pass: public room first sound in one click, warmer unlock moment showing the actual royalty split, and operation-scoped feedback instead of one global transaction toast. | new ticket | Proposed |

## Ordering and guardrails

- Standalone production remains first-class. Product SDK mode is progressive
  enhancement, not a replacement for the link-first web app.
- Product-host permissions must fail explicitly. Do not silently fall back to
  unsafe demo secrets, hidden signers, or bypassed access checks.
- Nothing in Later starts before standalone production is green, per the
  production readiness rule in `README.md` (this folder).
- Every Next/Later item passes the philosophical decision filter before being
  cut into a ticket: does it strengthen shared listening, artist sovereignty,
  and reduce friction without lying about security?
- When any Next item lands and changes public positioning or roadmap,
  `docs/index.html` is updated in the same PR.
- The through-line: contracts, encryption, rooms, and presentation have reached
  a credible testnet slice. The next risk is truthfulness: operate what exists,
  measure DAV2 and room behavior, then integrate the Polkadot product ecosystem
  only where the current APIs support Dotify's security and guest-friction
  promises.
