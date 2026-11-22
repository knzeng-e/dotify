# Dotify documentation

The [native account qualification 0.1.90 delivery](operations/host-account-0.1.90-delivery-2026-11-22.md) is
independently verified from source `ecba4ea0`. Its exact finite approval is
consumed; custody is restored/stopped and protected history is preserved. The
[client reference](operations/host-account-qualification-client.md) explains the
public-address snapshot and [device procedure](how-to/qualify-product-host-031.md).
The [owner's account report](backlog/implementation/evidence/host-account-ios-0.1.90-2026-11-22.md) now
accepts sharing/choice, and a separate finalized native read matches the existing
Revive mapping. Next are signer control and fresh-factory prerequisites; artist
onboarding and matched services remain separate.

The earlier [0.1.89 iPhone report](backlog/implementation/evidence/host-info-ios-0.1.89-2026-11-22.md)
accepts only Host info / Runtime 0.31.0. The prior
[provider blocker](operations/host-account-0.1.90-execution-blocker-2026-11-22.md)
was resolved through the late idle update; its support draft is historical.

The [21 November metadata/CDM checkpoint](operations/fresh-cdm-2026-11-21.md)
records Bulletin metadata and exact version 4 for the ten-contract
[fresh core](operations/fresh-testnet-2026-11-20.md). Hosted APIs and clients have
not switched; the old custody publisher is stopped for maintenance. The
[cutover procedure](how-to/prepare-fresh-testnet-generation.md) uses a maintenance
interruption: create the artist runtime with the artist wallet, configure its
Bulletin publisher, then start the matched services and clients. Native/device
acceptance remains open.

The [coordinated SDK 0.45 candidate](design/product-sdk-045-migration.md) upgrades
the Product family together and corrects legacy public-info decoding. Transaction
signers require a reported 0.31.x Runtime. The owner's new iPhone build 23
configuration supplies a target for [device qualification](how-to/qualify-product-host-031.md),
not a passed signing/media result. Deployed clients retain their prior pins;
CASH stays disabled.

The [20 November integration evidence](backlog/implementation/evidence/product-sdk-045-integration-2026-11-20.md)
records the candidate after the audit's tested dev baseline, separately from
pending physical Host acceptance.
The [qualification follow-up](backlog/implementation/evidence/product-sdk-045-qualification-2026-11-20.md)
records the corrected candidate checks and identified local build for review.

The [20 November A05 paid-access decision](reference/paid-release-access.md)
keeps earlier buyers authorized across access-mode changes while the release
remains active. It is a source candidate for the matched fresh generation;
withdrawal, upgrade and availability boundaries remain explicit.

The [18 November audit checkpoint](backlog/implementation/listening-and-publication-readiness.md#smart-runtime-audit-checkpoint-2026-11-18)
puts payment/contract corrections before further CASH work. The merged
[artist-runtime catalogue isolation](reference/catalog-runtime-isolation.md) is
followed by merged [finalized key authority](reference/finalized-key-authority.md).
Merged [artist authority](reference/runtime-artist-authority.md)
keeps artist identity separate from delegated technical administration.
Merged [NFT-free prices](reference/native-price-without-nft.md) provide exact
EVM/native prices, without token minting or holder-based access.
Merged [supported personhood handling](reference/personhood-status-policy.md)
keeps unknown/malformed evidence closed and typed diagnostics non-reverting.
Merged [directory pagination](reference/contracts-api.md#directory-page-bounds-a08)
bounds individual responses without overflowing or skipping artists in supported readers.
A complete fresh testnet generation follows the remaining audit fixes; no reset
or deployment is recorded by this source change. Earlier dated checkpoints
below retain their own scope.

The [17 November SDK/Host investigation](design/product-sdk-host-upgrade-decision-2026-11-17.md)
retains the older phone/Desktop observations. The [20 November owner evidence](backlog/implementation/evidence/product-host-ios-031-2026-11-20.md)
now starts qualification under #85/#483. Deployed pins are unchanged; CASH
still awaits actual Host, amount-unit and settlement evidence.

[The Bulletin Room baseline and repeat](backlog/implementation/evidence/bulletin-room-baseline-2026-11-17.md)
succeed on Eskapade à engong with 1.807-s and 0.842-s media preparation. Owner
Pause/guest/lock/artwork checks pass on both; the first includes end-of-track
confirmation, the second about 79 s of background observations.
[The subsequent solo/Room track-change artwork check](backlog/implementation/evidence/bulletin-track-change-artwork-2026-11-17.md)
also passes with owner-confirmed guest sound. Next is bounded #406 CASH-tip
research while other native/pilot gates remain. These observations are not a
cold-start benchmark or controlled speed claim.

Active listening acceptance is now [Bulletin-only](backlog/implementation/listening-and-publication-readiness.md#bulletin-only-readiness-scope-2026-11-17).
Adang Fobe's older IPFS path is excluded and its artist-signed retirement is
verified in the public catalogue; all four active releases use Bulletin.

The [public API cache delivery](backlog/implementation/evidence/api-cache-rollout-2026-11-16.md)
serves #477 on both replicas from `72e28eba`, with exact image/source, preserved
configuration and health/readiness checks passing. Web/Product stay 0.1.88.
The subsequent phone reports retain an initial 60-second timeout, a 41.562-s
retry and a later 29.114-s opening; Pause and guest sound are reported OK.
Reliable initial startup and hosted cache/memory acceptance remain open. Those
Adang Fobe observations concern the older IPFS path; next measure an existing
Bulletin-backed release, whose reader is separate.

The [0.1.88 client delivery](backlog/implementation/evidence/product-0.1.88-rollout-2026-11-15.md)
adds local relay/native/HTTP-header/body measurements. Independent delivery and
unchanged custody checks pass. One matching Wi-Fi phone check confirms Pause,
guest/lock sound and artwork, but preparation takes 34.857 s; the report locates
work in relay admission and pre-response HTTP waits without isolating a cause.
The [measurement guide](how-to/measure-room-startup.md#distinguish-transport-phases)
defines the fields and limits. No speedup or native-artwork correction is claimed.

The [0.1.87 client delivery](backlog/implementation/evidence/product-0.1.87-rollout-2026-11-15.md)
records verified delivery and one matching phone opening with Pause and guest/
short-lock sound. Preparation still takes 36.955 s and the lock-screen cover is
absent; latency and artwork reliability remain open.

The [0.1.86 client delivery](backlog/implementation/evidence/product-0.1.86-rollout-2026-11-14.md)
records deployed queued Room read reuse and one owner-confirmed phone opening
with Pause/guest/short-lock sound. The matching preparation takes 33.153 s;
repeated startup and latency acceptance remain open.

Start with the task you want to complete. Dotify is a shared-listening hub with
artist-owned runtimes; its [project overview](../README.md) explains the purpose
and shows the current interface.

Continuous listening implementation: [adaptive delivery, prepared transitions,
system controls and local resume](explanation/continuous-listening.md). Its
[W35 evidence](backlog/implementation/evidence/W35.md) separates browser checks
from physical Product acceptance and publication.

The [solo-to-Room continuity candidate](adr/0059-preserve-solo-during-room-preparation.md)
keeps current solo audio usable during authenticated mobile Room preparation;
matching physical-device acceptance remains open.

The [0.1.85 listening delivery](backlog/implementation/evidence/product-0.1.85-rollout-2026-11-14.md)
records the published Free-track correction: solo/retry listening is reported OK,
but the first phone Room opening still times out.

## Use Dotify

| I want to…                                        | Start here                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| Host, join or discover a listening room           | [Listen together](how-to/listen-together.md)                              |
| Check delayed lock-screen artwork | [Check system artwork](how-to/check-system-artwork.md) |
| Understand who needs a wallet or listening access | [Access policy](explanation/access-control-model.md)                      |
| Understand source protection and recording limits | [Content protection](explanation/content-protection.md)                   |
| Explore the interface                             | [Current captures and their provenance](images/release-preview/README.md) |

For an uncertain gift, tip or Classic purchase, use
[Check a pending payment](how-to/recover-a-payment.md) before starting another attempt.

## Develop

| I want to…                                 | Start here                                                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Run the app and its services               | [Local setup](how-to/develop-locally.md)                                                                        |
| Find frontend commands and modules         | [Web README](../web/README.md)                                                                                  |
| Understand the system and trust boundaries | [Architecture](explanation/architecture-overview.md)                                                            |
| Work on contracts                          | [EVM contracts](../contracts/README.md)                                                                         |
| Understand discovery and shared audio      | [Room mechanics](explanation/listening-rooms.md), [privacy contract](design/dotify-nearby-discovery-privacy.md) |
| Understand Product integration             | [Product architecture](explanation/product-devnet-architecture.md)                                              |
| Make a focused contribution                | [AGENTS.md](../AGENTS.md), [PR guide](explanation/pull-requests-as-knowledge-sharing.md)                        |

For documentation changes, follow [Document a change](how-to/document-a-change.md):
choose the reader, give each rule one home and keep evidence tied to its artifact.

For slow Room startup, [collect comparable listening reports](how-to/measure-room-startup.md),
including successful starts and physical locked-screen observations.

## Qualify the Product candidate

[Runtime 0.31 iPhone procedure](how-to/qualify-product-host-031.md): bind the
candidate, collect non-spending info, then separate identity, matched-generation
media and native payment acceptance.

## Look something up

- [Paid release access while active](reference/paid-release-access.md): mode changes, deactivation, signed keys and trust boundaries
- [Directory page bounds](reference/contracts-api.md#directory-page-bounds-a08): maximum page size, cursor handling and compatible readers
- [Supported personhood evidence](reference/personhood-status-policy.md): raw/typed diagnostics, unsupported tiers and fail-closed access
- [Exact prices and NFT-free releases](reference/native-price-without-nft.md): native precision, record ABI and coordinated fresh-generation delivery
- [Artist identity and administration](reference/runtime-artist-authority.md): stable publishing/profile authority and accepted administration transfer
- [Finalized key authority](reference/finalized-key-authority.md): irreversible key grants and conservative current-state denials
- [Artist-runtime catalogue isolation](reference/catalog-runtime-isolation.md): admission budgets, exclusions, freshness and repair
- [Bulletin proof read coordination](adr/0058-coordinate-bulletin-proof-loads.md): avoid duplicate block downloads while retaining per-query checks
- [Server Node runtime and offline reader packaging](reference/server-runtime.md)
- [Environment variables](reference/environment-variables.md)
- [Socket events and negotiation limits](reference/socket-events.md)
- [Development toolchain security](reference/development-toolchain.md)
- [HTTP request limits](reference/request-limits.md)
- [Host software support fields](reference/host-software-support.md): bounded optional software labels, without account/payment probes
- [Public artwork cache](reference/public-artwork-cache.md): bounded delivery independent of optional browser storage
- [API schema compatibility](reference/api-schema-compatibility.md)
- [Compact Bulletin delivery and admission](reference/bulletin-compact-delivery.md): explicit format, encrypted delivery and immutable source selection
- [Compact Bulletin object readers](reference/bulletin-compact-reader.md): authentication, bounds and cancellation
- [DAV2 encrypted audio](reference/audio-v2-container.md)
- [Contract reference](reference/contracts-api.md) and [generated bindings](../web/src/generated/contracts/)
- [Shared TypeScript source](../web/src/shared/types.ts)
- [Access and key-delivery threat model](security/content-key-delivery-threat-model.md)
- [CASH work-tip feasibility](design/product-cash-tip-decision-2026-11-13.md): dated API/recovery decision and remaining Host/settlement gates
- [Native contributions](design/native-contributions.md) and [royalty settlement](explanation/royalty-settlement.md)

## Operate and prepare a release

- [Verify deployment configuration](operations/deployment-configuration.md): identify affected components, compare settings and validate delivery.
- [Deployment history](operations/deployment-configuration-history.md): preserved dated checkpoints, outside the operating procedure.
- [Product publication](operations/product-devnet-deployment.md): package identity, signer boundary, publish and rollback.
- [Quality gates](operations/dev-quality-gates.md): automated verification.
- [Generated Bulletin resource envelope](operations/bulletin-resource-envelope.md): real encoding and standard/compact readback inside bounded local containers; hosted capacity remains separate.
- [Data-only custody checkpoint](operations/bulletin-custody-checkpoint.md): inspect a settled store, copy an exact plan and verify private data without keys or writer activation; operational use remains separate.
- [Isolated Bulletin reconstruction](operations/bulletin-isolated-restore.md): recover original data/history into a guarded review workspace after source loss; no service activation or key recovery.
- [Published Bulletin graph archive](operations/bulletin-published-archive.md): preserve reachable published blocks independently of pruned custody files and verify offline; no keys, history repair or writer activation.
- [Published Bulletin audio authentication](operations/bulletin-published-audio-check.md): check a published backup against separate trusted release/key inputs, without exporting plaintext or activating custody.
- [Recovered Bulletin key check](operations/bulletin-recovered-key-check.md): authenticate retained encrypted audio using explicitly recovered versions, without service activation; real transfer remains separate.
- [Generated Bulletin restore rehearsal](operations/bulletin-generated-restore-rehearsal.md): independent-runner fixture transfer, source loss, compiled historical compatibility and refusal checks; operational recovery remains separate.
- [Pilot release plan](operations/pilot-release-plan.md): device journeys, evidence and the release decision.
- [Dated implementation and rollout evidence](backlog/implementation/evidence/).

Ready code, deployed builds and accepted pilot journeys are different states.
A screenshot or browser fixture is not proof of native signing, settlement,
background audio or physical-device behavior.

## Direction and history

The proposed [relational experiences](design/relational-experiences.md) unite Rooms, place-based Imprints and artist-authored Resonance Gardens. The [community-gated roadmap](backlog/relational-experience-roadmap.md) describes exploratory steps and their technical/human checkpoints **without replacing the selected production-readiness sequence** or GitHub Project 5 statuses.

The [implementation plan](backlog/implementation/README.md) defines scope and
sequence; [Project 5](https://github.com/users/knzeng-e/projects/5) owns live
workflow status. [Product memory](context/dotify-product-memory.md),
[technical memory](context/dotify-technical-memory.md) and the
[north star](context/dotify-philosophical-north-star.md) explain the intent.
Older design notes and dated evidence retain their historical scope; use the
current plan and code before treating an old proposal as current behavior.

[Public project page](index.html) · [Presentation](presentation/dotify-showcase-2026.pdf) · [Product specification](../spec.md)
