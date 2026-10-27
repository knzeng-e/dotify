# Dotify documentation

Start with the task you want to complete. Dotify is a shared-listening hub with
artist-owned runtimes; its [project overview](../README.md) explains the purpose
and shows the current interface.

Continuous listening implementation: [adaptive delivery, prepared transitions,
system controls and local resume](explanation/continuous-listening.md). Its
[W35 evidence](backlog/implementation/evidence/W35.md) separates browser checks
from physical Product acceptance and publication.

## Use Dotify

| I want to…                                        | Start here                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| Host, join or discover a listening room           | [Listen together](how-to/listen-together.md)                              |
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

## Look something up

- [Environment variables](reference/environment-variables.md)
- [Socket events](reference/socket-events.md)
- [DAV2 encrypted audio](reference/audio-v2-container.md)
- [Contract reference](reference/contracts-api.md) and [generated bindings](../web/src/generated/contracts/)
- [Shared TypeScript source](../web/src/shared/types.ts)
- [Access and key-delivery threat model](security/content-key-delivery-threat-model.md)
- [Native contributions](design/native-contributions.md) and [royalty settlement](explanation/royalty-settlement.md)

## Operate and prepare a release

- [Deployment configuration](operations/deployment-configuration.md): Web/API/signaling settings, persistent state and checks.
- [Product publication](operations/product-devnet-deployment.md): package identity, signer boundary, publish and rollback.
- [Quality gates](operations/dev-quality-gates.md): automated verification.
- [Pilot release plan](operations/pilot-release-plan.md): device journeys, evidence and the release decision.
- [Dated implementation and rollout evidence](backlog/implementation/evidence/).

Ready code, deployed builds and accepted pilot journeys are different states.
A screenshot or browser fixture is not proof of native signing, settlement,
background audio or physical-device behavior.

## Direction and history

The [implementation plan](backlog/implementation/README.md) defines scope and
sequence; [Project 5](https://github.com/users/knzeng-e/projects/5) owns live
workflow status. [Product memory](context/dotify-product-memory.md),
[technical memory](context/dotify-technical-memory.md) and the
[north star](context/dotify-philosophical-north-star.md) explain the intent.
Older design notes and dated evidence retain their historical scope; use the
current plan and code before treating an old proposal as current behavior.

[Public project page](index.html) · [Presentation](presentation/dotify-showcase-2026.pdf) · [Product specification](../spec.md)
