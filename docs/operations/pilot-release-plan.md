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
- Last recorded published Product candidate: 0.1.65, clean packaging SHA
  `a553cc6a65a2f506ebcfaac2d66ce97451291d10`, based on tested merged dev
  `bd813f7e49183900a5970f665e4f18e74abd674d` (#344/#345), `product-cdm` on `devnet`,
  executable CID `bafybeicv4u5od4iqqhwoq5abhm3w3taof3di5euj3qvjo7ftkrldxnqu6y`.
  [Rollout evidence](../backlog/implementation/evidence/product-0.1.65-rollout-2026-10-28.md)
  records early-segment managed mobile AAC and About, retained API 34/custody 3/shared
  state, exact public artifact checks and separate physical-device gate.
- #335-#337 and W35 are published with W36/W37. Installed Host refresh,
  payment/publication and audible continuity require new candidate-bound
  observations; prior device evidence does not certify this executable.
- Readiness command:

```bash
cd web
npm run smoke:pilot-release -- \
  --md-out /tmp/dotify-pilot-release-readiness.md \
  --json-out /tmp/dotify-pilot-release-readiness.json
```

Add `--product-smoke-json` and `--room-json` for this published `product-cdm`
release. Supply its executable CID through `--pilot-release-cid`, and
`--rollback-json` for a rehearsal of that exact candidate. Add `--pilot-json`
only after the consented participant pilot has run on the matching release CID.
Missing live artifacts must stay visible as `blocked` or `not-run`.

The original consolidation is recorded in
[`W13-consolidation-2026-09-17.md`](../backlog/implementation/evidence/W13-consolidation-2026-09-17.md).
It verifies the merged code through PR #173, but it is not a deployed candidate
identity. If `dev`, the Product appVersion, profile or executable CID changes,
recapture every live input. Product payment, room, rollback and pilot evidence
must identify the same published CDM executable CID. The historical
[0.1.29 live evidence](../backlog/implementation/evidence/W13-candidate-0-1-29-live-2026-09-28.md)
record used a separate 0.1.29 validation CID
`bafybeihawlfqhqgipiwg2dj5iamchz22e3d6z6t7t5snc4iv3333bdavom` and a distinct default-`viem` release CID
`bafybeihe4oty4sdifkbajty76kgj5gasvoqqpv5bnssmg65mcdhduqwpkm`.

## Environment And Config Diff

The October 22 streaming-only reset deployed fresh contracts, CDM version 2,
non-root storage and the private encoding pipeline. Product 0.1.62 then deployed
W34 on the API before its clients, without a contract, permission or secret
change. Product 0.1.63 then activated W35-W37 with two public API replicas,
shared PostgreSQL and one private publication-custody writer. Product 0.1.65
adds managed mobile AAC and the Free-startup correction without changing that topology. Use the dated
[deployment configuration](deployment-configuration.md) and exact rollout record
for environment/persistence differences; older 0.1.29/0.1.48 observations are
historical and do not validate the current reset catalog.

| Surface | Current tracked value | W13 action |
| --- | --- | --- |
| Product name | `dotify-test01.dot` | Keep |
| Public Product URL | `https://dotify-test01.dev-dot.li` | Keep |
| Product appVersion | `[0, 1, 64]` | Published from the packaging SHA and CID above. Candidate-bound native payment, publication, room, rollback and aggregate pilot evidence remain open. |
| Runtime write adapter | `product-cdm` on `devnet` | Match the published Product profile; ordinary web uses viem. |
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
| ArtistRuntimeFactory | `0x708d35eee7c1416f6d332344068be9d714aec24c` |
| ArtistDirectory | `0x8e611ef60169f8ed93019de4a3034a504ae2ad29` |
| Initializer | `0x47c0d0319f1235e3820e3a5291644ec94a53c105` |
| DiamondCut facet | `0xae55a2bd754dad2592e929ee70c9961b3ab88c17` |
| DiamondLoupe facet | `0x5ce28a06ab007cb36e6da098061374a5997851de` |
| Ownership facet | `0x8da0b360546567bcdc4b8bf96e9f2703cc3b81b3` |
| Registry facet | `0x726eee6e4aa000b9b8185164ee56b1fe90650b31` |
| NFT facet | `0x7078d237b0be431c9ee98900f7db296595e041ec` |
| Royalties facet | `0x8262a1ac59ba8afca9c2f8dbde038fb68df21821` |
| Access facet | `0x1e2cbc630420b037597539f1a00664de50c3ef6b` |

Product/CDM anchors:

| Item | Value |
| --- | --- |
| Product DevNet CDM | Directory/factory version 2 in `web/src/generated/contracts/cdm.json`; verify the selected Host environment through the deployment preflight |
| Product SDK | `@parity/product-sdk@0.39.0` |
| Product host SDK | `@parity/product-sdk-host@0.28.0`, TrUAPI `0.25.0` |
| Statement Store SDK | `@parity/product-sdk-statement-store@0.7.3` |
| Product deploy CLI | `@parity/polkadot-app-deploy@0.20.0` plus the host-profile preflight |

The earlier 0.1.29 gate had separate CDM validation and default-viem release
CIDs. For the recorded 0.1.65 gate, supply the published CDM executable CID
through `--pilot-release-cid`. The readiness script requires matching Product
payment/key, room, rollback and pilot candidate identities. Do not repeat a
paid transaction to populate another evidence file.

## Rollback

Use a compatible **current-format** artifact and preserve the current server
state. Product 0.1.64 is the recorded client rollback artifact for 0.1.65;
[the rollout record](../backlog/implementation/evidence/product-0.1.65-rollout-2026-10-28.md)
and [deployment runbook](deployment-configuration.md) bind its exact identity.
The September 0.1.25/0.1.29 rehearsal is historical evidence, not a safe target
for the reset catalog.

1. Bind the candidate and compatible rollback to exact SHA, CID, appVersion,
   Host profile and retained CAR/config. Do not rebuild a historical artifact
   and call it byte-identical. Client rollback precedes any API rollback.
2. Retain the latest keys, catalog, receipts, revocations, session epoch and
   permanent nonce reservations. Never overwrite later writes with a pre-reset
   snapshot. Keep current-format key custody, the shared database and the one private
   custody writer. Do not revert to a local-state API after shared writes.
3. Follow the [Product publication procedure](product-devnet-deployment.md),
   including Host-profile preflight, local signer and guarded root/app updates.
   Verify finalized contenthashes, executable manifest/appVersion and public
   artifact bytes. Keep the signer local and remove it after publication.
4. Check existing entitlement/key delivery and walletless room sound without
   another payment. Then restore the exact candidate artifact and repeat those
   checks, including any consented Host-cache reset actually needed.
5. Record old/new identities, finalized references, preserved custody/state,
   session interruption and actual results in candidate-bound W13 evidence.

An artifact rollback/readback is not a physical payment/audio acceptance claim.
Do not infer a completed rehearsal or pilot from static readiness checks.

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
| Product Desktop | Requires exact installed Host/build signing, current-format playback, room and recovery evidence. Historical CDM observations do not certify 0.1.63 or later candidates. |
| Product Web gateway | Public artifact verification exists for 0.1.63; candidate-bound audible access, signing and room acceptance remains separate. |
| Product mobile | Requires physical in-app permission/location, signing, WebRTC audio, background/reopen and form checks on the selected Host build. Browser viewport/Host fixtures are insufficient. |

Unsupported surfaces must stay visible in the readiness report rather than being
inferred from Chromium or static Product builds.

## Pilot Protocol

The owner's October 17 amendment caps the consented pilot at **42 participants
across several continents**. The earlier 3 artists / 5 hosts / 20 listeners
proposal is superseded. The owner chooses the role mix, recruits and obtains
consent; agents do not send unsolicited invitations. Retain aggregate region
and outcome counts only. W13 targets at least 20 observed supported-device
joins, with actual success and uncertainty reported against the 95% target.

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
decision to the exact candidate build being evaluated. This example is synthetic;
replace every count, timestamp and result with observed candidate-bound evidence:

```json
{
  "schemaVersion": 2,
  "candidate": {
    "gitSha": "<40-character-git-sha>",
    "productAppVersion": "[0, 1, 63]",
    "runtimeAdapterKind": "product-cdm",
    "productChain": "devnet",
    "deployedCid": "<published-product-cdm-cid>",
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

Run the aggregate gate with the published CDM release CID:

Run this command from a clean checkout at the **deployed candidate SHA**.
The harness deliberately binds evidence to `git HEAD`; a later documentation
commit will fail the SHA gates even when the Product JSON is genuine.

```bash
npm run smoke:pilot-release -- \
  --product-smoke-json /path/to/product-cdm-host-smoke.json \
  --room-json /path/to/product-cdm-room-evidence.json \
  --pilot-release-cid <published-product-cdm-cid> \
  --rollback-json /path/to/candidate-bound-rollback-evidence.json \
  --pilot-json /path/to/aggregate-pilot-evidence.json
```

The Product smoke, room, rollback and pilot artifacts must all bind to the
published `product-cdm` CID supplied through `--pilot-release-cid`. The
rollback artifact is independent of the future pilot cohort and binds the
old/new DotNS transactions and catalog/key checks to that release CID. All
artifacts must use the same candidate git SHA and appVersion.

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
