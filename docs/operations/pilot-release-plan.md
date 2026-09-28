# W13 Pilot Release Plan

This is the reversible release package for W13, the first coherent Dotify pilot
gate. It does not declare the pilot shipped. It records what can be released,
how to verify it, how to roll it back, and what evidence must exist before a
small consented community is counted as served.

## Release Candidate

- Release branch: create from the tested `dev` candidate selected for the pilot.
- Issue: #158.
- Original consolidation base: `dev` at
  `f4d2d49721a85169c5f9c37d36ac2ef315396d57`.
- Current published candidate SHA: `b18f24acdc53c055bd9f10cdcbefd3985fa84927`.
- Readiness command:

```bash
cd web
npm run smoke:pilot-release -- \
  --md-out /tmp/dotify-pilot-release-readiness.md \
  --json-out /tmp/dotify-pilot-release-readiness.json
```

Add `--product-smoke-json` and `--room-json` for the explicit `product-cdm`
validation deployment. Supply `--pilot-release-cid <cid>` for the separately
published default-`viem` release, and `--rollback-json` for the independent
rollback rehearsal. Add `--pilot-json` only after the consented participant
pilot has run on the matching release CID.
Missing live artifacts must stay visible as `blocked` or `not-run`.

The original consolidation is recorded in
[`W13-consolidation-2026-09-17.md`](../backlog/implementation/evidence/W13-consolidation-2026-09-17.md).
It verifies the merged code through PR #173, but it is not a deployed candidate
identity. If `dev` or the Product appVersion changes, recapture every live
input. If the validation CID changes, recapture Product CDM and room evidence;
if the default `viem` release CID changes, recapture pilot evidence. Never bind
the pilot decision to the Product CDM validation CID. The
[0.1.29 live evidence](../backlog/implementation/evidence/W13-candidate-0-1-29-live-2026-09-28.md)
records the validation CID
`bafybeihawlfqhqgipiwg2dj5iamchz22e3d6z6t7t5snc4iv3333bdavom` and
the distinct default-`viem` release CID
`bafybeihe4oty4sdifkbajty76kgj5gasvoqqpv5bnssmg65mcdhduqwpkm`.

## Environment And Config Diff

The original tracked W13 package did not change hosted secrets, origins,
contract addresses, Fly scaling, Product permissions, or DotNS ownership.
During live 0.1.29 validation, the missing shared TURN capability secret was
installed on the API and signal services, and those services were redeployed;
their origin allowlists and contract addresses were not changed. The release
profile differs from the CDM validation bundle, not from those service values.

| Surface | Current tracked value | W13 action |
| --- | --- | --- |
| Product name | `dotify-test01.dot` | Keep |
| Public Product URL | `https://dotify-test01.dev-dot.li` | Keep |
| Product appVersion | `[0, 1, 29]` | CDM validation, payment/key smoke, and Product Desktop room smoke captured on the validation CID above. The separate default-`viem` release CID above is published. Physical-device matrix, rollback, and aggregate pilot remain open. |
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
| Product deploy CLI | `@polkadot-community-foundation/polkadot-app-deploy@0.16.7` plus the host-profile preflight |

Product has two deliberately separate deployment identities during this gate.
The CDM validation CID above is payment/key and room evidence only. The default
`viem` CID above is the published pilot release identity; supply it through
`--pilot-release-cid`. The readiness script never infers it from the validation
artifacts. Do not repeat the paid transaction to populate another evidence file.

## Rollback

Rollback is static and reversible:

An owner-approved temporary rollback/restore was rehearsed on 2026-09-29.
The rebuilt 0.1.25 CDM/debug CAR was published at
`bafybeicew7wtqc6s6kq37nnv3yzsfg2tq4dalaxbamrvs443z4ikhunrsa`;
Product Desktop loaded its 12-track catalog and reopened an already-paid
protected track with audible playback, without another payment. The exact
prior 0.1.29 default-`viem` release CID
`bafybeihe4oty4sdifkbajty76kgj5gasvoqqpv5bnssmg65mcdhduqwpkm`
was then restored on both DotNS names, and the same catalog/key/playback
check passed after a cache clear. The old rebuilt CID is **not** proven
byte-identical to the historical 0.1.25 room-proven CID. A 0.1.26 or
default-`viem` reconstruction is not a substitute for that target.

The rehearsal used `--no-manifest` to avoid `pad --input-car` independently
uploading the executable path from a config with different bytes. It changed
both contenthashes but left manifest text records unchanged. This is adequate
evidence for the observed single-account content/access recovery, **not** a
complete long-lived rollback procedure with consistent Product metadata.
Product Desktop also mixed JavaScript from adjacent CIDs until its cache was
cleared with owner consent on each switch. Prefer an isolated alias for future
rehearsals; on a public test name, warn that active sessions may reload. Never
store or paste the DotNS phrase into the repo or chat.

1. Identify the selected old commit, build flags, Product appVersion, and
   observed CID. Preserve the exact current release CAR and config before
   switching; verify the CAR's storage CID equals the currently published CID.
   Do not rebuild the release from a documentation branch for restoration.
2. In a clean checkout at the selected old SHA, run `npm ci`,
   `npm run smoke:production-env`, `npm run smoke:devnet`, and
   `npm run smoke:product-journey`. Build with the selected Product profile,
   then verify the embedded SHA and appVersion. A static journey with missing
   live JSON remains blocked, not passed.
3. With explicit owner approval for the exact candidate CID and a locally
   entered DotNS mnemonic, verify the signer owns both names, then publish
   the selected old CAR using `pad` 0.16.7 `--input-car --no-manifest`.
   Verify the finalized CID against the offline preflight and link the
   executable subname to that exact CID with owner/current-CID guards. Do not
   let config-driven manifest publishing upload a different `dist-product`.
4. Confirm Product loads that CID, the current catalog still resolves, and an
   already-entitled protected track releases its key without another payment.
   Then restore both names to the preserved exact 0.1.29 release CID (or
   re-upload its preserved CAR if necessary), verify both finalized on-chain
   contenthashes, clear a stale Product host cache with owner consent if
   needed, and repeat the catalog/key check. For a lasting rollback, update
   and verify root/executable manifest text records and appVersion too.
5. Keep Fly API and signaling origin allowlists unchanged while public Product
   or Netlify clients may still call them.
6. Record both finalized DotNS transactions/CIDs, commit identities, observed
   catalog/key results, session interruption, and any failure in W13 evidence.

Catalog and key compatibility is additive: older `dotify:enc:v2:key-vN` refs
remain readable only while their matching backend key-version secret is retained.
Do not rotate or remove legacy key versions during W13.

## Monitoring

Before and during the pilot, use these surfaces:

| Surface | Check |
| --- | --- |
| API health | `GET https://dotify-api.fly.dev/health` and `/health/ready` |
| Catalog | `GET https://dotify-api.fly.dev/api/catalog` with block lag and item count |
| TURN | Join/open a room, request a signaling capability, then call `GET https://dotify-api.fly.dev/api/turn/grant` with that bearer proof; an anonymous request must return `401` |
| Signaling | `GET https://dotify-signal.fly.dev/health` and `/status` |
| Product static gates | `npm run smoke:product-journey` |
| Pilot release gate | `npm run smoke:pilot-release` |
| Audio startup QA | Clean-candidate First-sound evidence export with one explicit device/OS/browser/network profile under `You -> Production readiness`; raw bounded snapshot remains available at `window.__DOTIFY_AUDIO_STARTUP__.snapshot()` |
| Room quality QA | `window.__DOTIFY_ROOM_QUALITY__.snapshot()` |
| Product CDM QA | Debug panel exported Product CDM host smoke JSON |
| Product room QA | Debug panel exported Product room smoke JSON, derived from host telemetry plus explicit guest-device observations |

Redact logs before sharing. Never store content keys, session tokens, raw
signatures, private keys, IP addresses, exact locations, or wallet-linked
listening history as pilot evidence.

## Supported Surfaces

| Surface | W13 release claim |
| --- | --- |
| Standalone desktop browser | Candidate for pilot after local and hosted smoke |
| Standalone mobile browser | Candidate for pilot after real-device Free/playback/room smoke |
| Product Desktop | CDM validation CID: existing paid access, full key release, audible protected playback, and hosted room to walletless Firefox guest observed. Desktop mobile-signing attempt was canceled; default-`viem` release first-sound confirmation remains open. |
| Product Web gateway | CDM validation CID: new 4.2 PAS native payment, entitlement read-back, full key release, and audible protected playback observed. Owner reloaded the default-`viem` release and reopened existing paid access; release audio and a separate Web-hosted room capture remain open. |
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
    "productAppVersion": "[0, 1, 29]",
    "deployedCid": "<default-viem-pilot-release-cid>",
    "capturedAt": "2026-09-28T12:00:00.000Z"
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

For visual proof, retain the original screenshot privately with its observed
surface, capture time, and candidate identity. Record whether it is an
operator capture or participant-provided. Redact account identifiers before
sharing; do not publish signing prompts, secrets, or unconsented participant
details. A visible player or `In sync` label does not by itself prove audible
sound, successful recovery, or the aggregate join target.

Run the aggregate gate with the independently recorded release CID:

Run this command from a clean checkout at the **deployed candidate SHA**.
The harness deliberately binds evidence to `git HEAD`; a later documentation
commit will fail the SHA gates even when the Product JSON is genuine.

```bash
npm run smoke:pilot-release -- \
  --product-smoke-json /path/to/product-cdm-host-smoke.json \
  --room-json /path/to/product-cdm-room-evidence.json \
  --pilot-release-cid <default-viem-pilot-release-cid> \
  --rollback-json /path/to/candidate-bound-rollback-evidence.json \
  --pilot-json /path/to/aggregate-pilot-evidence.json
```

The Product smoke and room artifacts retain the `product-cdm` deployment CID.
The rollback artifact is independent of the future pilot cohort and binds the
old/new DotNS transactions and catalog/key checks to that release CID. The
pilot artifact and `--pilot-release-cid` retain the separately deployed
default `viem` CID. All tracks must use the same candidate git SHA.

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
