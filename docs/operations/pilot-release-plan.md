# W13 Pilot Release Plan

This is the reversible release package for W13, the first coherent Dotify pilot
gate. It does not declare the pilot shipped. It records what can be released,
how to verify it, how to roll it back, and what evidence must exist before a
small consented community is counted as served.

## Release Candidate

- Release branch: create from the tested `dev` candidate selected for the pilot.
- Issue: #158.
- Current consolidation base: `dev` at
  `f4d2d49721a85169c5f9c37d36ac2ef315396d57`.
- Candidate SHA: use `git rev-parse HEAD` after the release branch is pushed.
- Readiness command:

```bash
cd web
npm run smoke:pilot-release -- \
  --md-out /tmp/dotify-pilot-release-readiness.md \
  --json-out /tmp/dotify-pilot-release-readiness.json
```

Add `--product-smoke-json` and `--room-json` for the explicit `product-cdm`
validation deployment. Add `--pilot-release-cid <cid>` and `--pilot-json` only
after the same SHA and Product appVersion have been published again with the
default `viem` release profile and the pilot was run on that release CID.
Missing live artifacts must stay visible as `blocked` or `not-run`.

The current consolidation is recorded in
[`W13-consolidation-2026-09-17.md`](../backlog/implementation/evidence/W13-consolidation-2026-09-17.md).
It verifies the merged code through PR #173, but it is not a deployed candidate
identity. If `dev` or the Product appVersion changes, recapture every live
input. If the validation CID changes, recapture Product CDM and room evidence;
if the default `viem` release CID changes, recapture pilot evidence. Never bind
the pilot decision to the Product CDM validation CID.

## Environment And Config Diff

The tracked W13 package does not change hosted secrets, origins, contract
addresses, Fly scaling, Product permissions, or DotNS ownership. The intended
release diff is the application bundle and this release/evidence package.

| Surface | Current tracked value | W13 action |
| --- | --- | --- |
| Product name | `dotify-test01.dot` | Keep |
| Public Product URL | `https://dotify-test01.dev-dot.li` | Keep |
| Product appVersion | `[0, 1, 23]` | Publish and recapture evidence; this bundle keeps room-link arrival free of Product chain setup and retains native extrinsic proof links plus the native-unit fix |
| Runtime write adapter | `viem` by default | Keep until Product CDM write evidence passes |
| API | `https://dotify-api.fly.dev` | Keep |
| Signaling | `https://dotify-signal.fly.dev` | Keep |
| Asset Hub EVM RPC | `https://eth-rpc-testnet.polkadot.io/` | Keep; chain id `420420417` |
| Browser secrets | `VITE_PINATA_JWT=` and `VITE_CONTENT_SECRET=` | Keep empty |
| Room beacons | `VITE_DOTIFY_ROOM_BEACONS=off` | Keep off for default pilot release |
| API origins | Netlify, public DotNS gateway, Product host HTTPS/native origins | Keep exact allowlist |
| Signal origins | Same Product/public origin set as API | Keep exact allowlist |

Do not add `Origin: null`, unrestricted Pinata credentials, or content-key
secrets to any public frontend profile.

## Contracts And Product Bundle

Current Product DevNet contract inventory from `deployments.json`:

| Contract | Address |
| --- | --- |
| ArtistRuntimeFactory | `0x835a626a9a6965b197d079ae56b1ec94033c2699` |
| ArtistDirectory | `0x4e883827d61e573094c7b777bae323070ea9f954` |
| Initializer | `0x2fbc3f13b31c3401b3f48c4353388a106e3ad04e` |
| DiamondCut facet | `0xc0c5bb476e0b23739363c1b6b6fd39b562c560f7` |
| DiamondLoupe facet | `0xfb4a566fa568d9381c8043c2df3a5bf5d0c9716e` |
| Ownership facet | `0x518e0b757f540b99aa8c900075e4f31063e372fa` |
| Registry facet | `0xe28c5214ac05399feaf1ce59b681579323faa9b0` |
| NFT facet | `0x6d43a4edad97f3f93ec5ee5a9b4e7d9f81ea9f0b` |
| Royalties facet | `0x504ad3fef36e2e7f9865cbd9c8eea8e44358b71a` |
| Access facet | `0xcf52a77b429693f83218863737966c1867f5133c` |

Product/CDM anchors:

| Item | Value |
| --- | --- |
| Product DevNet CDM `ContractRegistry` | `0x05662b3dbd5dd9f2ff92d67630477e84b0b37c1f` |
| Retired registry to avoid | `0x59b0245778917af55224e5f8fb55f7f8d452619f` |
| Product SDK | `@parity/product-sdk@0.27.0` |
| Product host SDK | `@parity/product-sdk-host@0.19.1` |
| Statement Store SDK | `@parity/product-sdk-statement-store@0.6.9` |
| Product deploy CLI | `@polkadot-community-foundation/polkadot-app-deploy@0.16.2` |

Product has two deliberately separate deployment identities during this gate.
Capture the `product-cdm` CID for payment/key and room validation only. After
that validation, run the unmodified `npm run deploy:product-devnet` command and
capture its default `viem` CID as the pilot release identity. Supply that second
CID through `--pilot-release-cid`; the readiness script never infers it from the
validation artifacts.

## Rollback

Rollback is static and reversible:

1. Identify the last known-good `dev` or Product release commit and its DotNS
   contenthash/CID.
2. Build from that commit with `npm ci`, `npm run smoke:production-env`,
   `npm run smoke:devnet`, `npm run smoke:product-journey`, and
   `npm run build:product-devnet`.
3. Republish `dotify-test01.dot` with the authorized DotNS owner mnemonic.
4. Confirm the public Product URL resolves to the restored CID.
5. Keep Fly API and signaling origin allowlists unchanged while public Product
   or Netlify clients may still call them.
6. Record the rollback CID, commit, reason, and any catalog/key compatibility
   notes in the W13 evidence.

Catalog and key compatibility is additive: older `dotify:enc:v2:key-vN` refs
remain readable only while their matching backend key-version secret is retained.
Do not rotate or remove legacy key versions during W13.

## Monitoring

Before and during the pilot, use these surfaces:

| Surface | Check |
| --- | --- |
| API health | `GET https://dotify-api.fly.dev/health` and `/health/ready` |
| Catalog | `GET https://dotify-api.fly.dev/api/catalog` with block lag and item count |
| TURN | `GET https://dotify-api.fly.dev/api/turn/grant` for route availability only |
| Signaling | `GET https://dotify-signal.fly.dev/health` and `/status` |
| Product static gates | `npm run smoke:product-journey` |
| Pilot release gate | `npm run smoke:pilot-release` |
| Audio startup QA | `window.__DOTIFY_AUDIO_STARTUP__.snapshot()` |
| Room quality QA | `window.__DOTIFY_ROOM_QUALITY__.snapshot()` |
| Product CDM QA | Debug panel exported Product CDM host smoke JSON |

Redact logs before sharing. Never store content keys, session tokens, raw
signatures, private keys, IP addresses, exact locations, or wallet-linked
listening history as pilot evidence.

## Supported Surfaces

| Surface | W13 release claim |
| --- | --- |
| Standalone desktop browser | Candidate for pilot after local and hosted smoke |
| Standalone mobile browser | Candidate for pilot after real-device Free/playback/room smoke |
| Product Desktop | Blocked until Product host CDM unlock and room evidence are captured |
| Product Web gateway | Not run until a separate web-gateway host smoke is captured |
| Product iOS | Only external-browser continuation can be claimed until in-app WebRTC is proven |

Unsupported surfaces must stay visible in the readiness report rather than being
inferred from Chromium or static Product builds.

## Pilot Protocol

The proposed pilot size is intentionally small:

| Role | Target | Owner action |
| --- | --- | --- |
| Artists | 3 | Owner recruits and obtains consent |
| Hosts | 5 | Owner recruits and schedules rooms |
| Listeners | 20 | Owner recruits, with no unsolicited outreach by agents |

Pilot tasks:

1. Artist publishes a Free or Classic release.
2. Host starts a room from a supported surface.
3. Listener joins from a shared link or QR code without connecting a wallet.
4. Host or listener recovers after refresh, network interruption, or reconnect.
5. Artist or listener inspects payment split/control facts.
6. Listener completes a support action where supported.

Do not contact participants, send invitations, or claim acceptance without
explicit owner authorization.

## Data Collection

Collect aggregate facts only:

| Metric | Shape |
| --- | --- |
| Time to first sound | Median/p95 seconds by supported surface |
| Join success | Successful supported-device joins over observed attempts |
| Recovery time | Median seconds to audible recovery |
| Support completion | Count completed and failed, with failure categories |
| Understanding | Aggregate yes/no counts for artist control and value flow |

The `--pilot-json` artifact must use pilot schema v2 and bind the aggregate
decision to the exact candidate build being evaluated:

```json
{
  "schemaVersion": 2,
  "candidate": {
    "gitSha": "<40-character-git-sha>",
    "productAppVersion": "[0, 1, 23]",
    "deployedCid": "<default-viem-pilot-release-cid>",
    "capturedAt": "2026-09-13T12:00:00.000Z"
  },
  "participants": { "artists": 3, "hosts": 5, "listeners": 20 },
  "tasks": {
    "publish": true,
    "startRoom": true,
    "joinFromLinkOrQr": true,
    "recoverAfterInterruption": true,
    "inspectSplit": true,
    "supportArtist": true
  },
  "outcomeMetrics": {
    "timeToFirstSoundSeconds": { "median": 1.8, "p95": 3.4, "sampleSize": 20 },
    "recoveryTimeSeconds": { "median": 4.2, "sampleSize": 7 },
    "supportCompletion": { "completed": 8, "failed": 1, "failureCategories": { "userCanceled": 1 } },
    "understanding": { "artistControlYes": 18, "artistControlNo": 2, "valueFlowYes": 17, "valueFlowNo": 3 }
  },
  "joinAttempts": { "observed": 20, "successful": 19 },
  "privacy": {
    "consentCaptured": true,
    "aggregateOnly": true,
    "continuousLocationCollected": false,
    "walletLinkedListeningHistoryCollected": false,
    "rawInterviewResponsesStored": false
  },
  "rollback": { "rehearsed": true, "catalogKeyCompatibility": "passed" },
  "goNoGo": {
    "decision": "hold",
    "prioritizedFixes": ["Improve first-sound time", "Document Product host limits", "Rehearse support retry"]
  }
}
```

Do not collect continuous location, exact coordinates, wallet-linked listening
history, contact details, raw interview answers, content keys, private keys,
session tokens, signatures, or per-person traces.

Run the aggregate gate with the independently recorded release CID:

```bash
npm run smoke:pilot-release -- \
  --product-smoke-json /path/to/product-cdm-host-smoke.json \
  --room-json /path/to/product-cdm-room-evidence.json \
  --pilot-release-cid <default-viem-pilot-release-cid> \
  --pilot-json /path/to/aggregate-pilot-evidence.json
```

The Product smoke and room artifacts retain the `product-cdm` deployment CID.
The pilot artifact and `--pilot-release-cid` retain the separately deployed
default `viem` CID. Both tracks must use the same git SHA and Product appVersion.

## Go/No-Go Record

The pilot decision record must include:

| Field | Requirement |
| --- | --- |
| Decision | `go`, `no-go`, or `hold` |
| Candidate | Exact git SHA, Product appVersion, exact deployed CID |
| Join target | At least 20 supported-device attempts, target `>=95%` successful |
| Failures | Count and category, not raw participant logs |
| Rollback | Safe-environment rehearsal and catalog/key compatibility result |
| Fixes | Exactly three prioritized fixes before the next sequence |

Until this record is populated from real use, W13 is release-package ready only,
not pilot-shipped.
