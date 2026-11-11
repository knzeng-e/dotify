# Verify a deployment configuration

Use this guide when preparing or reviewing a Dotify Web, Product, API, custody,
encoder or signaling delivery. It identifies what to compare and what evidence
to retain. Component runbooks contain the actual publication and maintenance
procedures; this guide does not authorize or execute a delivery.

## Establish the state first

Record the candidate commit and affected components before changing settings.
Keep three statements separate:

| State                  | Evidence needed                                           |
| ---------------------- | --------------------------------------------------------- |
| Implemented and tested | Exact commit, relevant checks and their results           |
| Deployed               | Served build/image identity and a dated rollout record    |
| Accepted               | The user journey passed on the named devices and versions |

At the **2026-11-11 documentation checkpoint**, the latest recorded delivery is
Web/Product/public API **0.1.82**, with custody on the **#426** optimization.
See the [custody delivery](../backlog/implementation/evidence/bulletin-round-trips-rollout-2026-11-10.md)
and [subsequent publication acceptance](../backlog/implementation/evidence/bulletin-eskapade-activation-2026-11-11.md).
The #430 compact-layout code and #434 security candidate are not deployment
records. This checkpoint is not a fresh inspection of hosted state. Before a
new intervention, compare the actual served identities with the reviewed plan.

Do not infer an active key, remaining publication allowance, available quota or
permission to reuse an admission from this page. Use the applicable private
review package and component checks; preserve existing receipts and history.

## Hosted surfaces

These links describe tracked candidate settings, not a readback of dashboards.
Read exact origins, addresses and scaling values from the reviewed commit rather
than copying an old release table.

| Component                        | Tracked source                                                                                               | Procedure or reference                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Web / Netlify `muzinga`          | [netlify.toml](../../netlify.toml)                                                                           | [Web commands](../../web/README.md), [environment variables](../reference/environment-variables.md) |
| Product `dotify-test01.dot`      | [build profile](../../web/.env.product-devnet), [deployment config](../../web/polkadot-app-deploy.config.ts) | [Product publication](product-devnet-deployment.md)                                                 |
| Public API `dotify-api`          | [fly.toml](../../services/api/fly.toml)                                                                      | [Local setup](../how-to/develop-locally.md), [shared-state operations](shared-api-state.md)         |
| Private writer `dotify-custody`  | [fly.custody.toml](../../services/api/fly.custody.toml)                                                      | [Bulletin publication](bulletin-artist-publication.md)                                              |
| Private encoder `dotify-encoder` | [fly.encoder.toml](../../services/api/fly.encoder.toml)                                                      | [Streaming publication](streaming-publication.md)                                                   |
| Room signaling `dotify-signal`   | [fly.signal.toml](../../web/fly.signal.toml)                                                                 | [Socket events and limits](../reference/socket-events.md), [Web commands](../../web/README.md)      |
| TURN relay                       | API/signaling environment contract                                                                           | [Environment variables](../reference/environment-variables.md)                                      |

## Security boundary

Every `VITE_*` value is public. Keep wallet secrets, upload credentials,
content-key secrets and private worker tokens out of frontend builds and logs.
Use the [key-delivery threat model](../security/content-key-delivery-threat-model.md)
for authority and revocation, and the [environment reference](../reference/environment-variables.md)
for variable names and ownership. Preserve retained content-key versions needed
by existing releases; a missing version must fail closed.

Allow exact reviewed Web/Product origins. The public share-link origin and the
Host execution origin can differ. Preserve observed native Host handling, but
never add wildcard CORS or literal `Origin: null` to make a test pass. Compare
`API_ORIGINS` and `SIGNAL_ORIGINS` in their tracked files and actual deployment;
a secret override can shadow a non-secret setting.

The [HTTP request limits](../reference/request-limits.md) and
[Room negotiation limits](../reference/socket-events.md#negotiation-limits)
are references for the security candidate. Their presence in source does not
mean the running service has that build. The remaining Zod migration is
[#432](../backlog/api-schema-security-migration.md); development-tool advisories
are tracked in [#433](../backlog/tooling-security-migration.md).

The [internal compact object readers](../reference/bulletin-compact-reader.md)
add no environment variable, HTTP endpoint, selector or admission. Their source
availability is not a compact-format deployment or permission to publish it.

## Prepare the affected components

### Netlify frontend

Use the reviewed branch/commit and the existing project's settings. Build-time
`VITE_*` changes require a new build; editing the dashboard does not change an
already served bundle. Confirm the build and publish paths against
[netlify.toml](../../netlify.toml). Keep frontend secrets out of all contexts,
including deploy previews.

### Product DevNet frontend

Follow [Product publication](product-devnet-deployment.md) for package identity,
retention checks, budget, signer handling, readback and rollback. Record the
commit, app version and executable CID. A completed upload alone is not proof
that DotNS points to it or that the Host can run it.

### Fly backend API

Determine whether the change affects public API replicas, custody, the encoder,
or several components. Do not replace one role's configuration with another's.
Check shared state, mounts, retained keys and readiness using the appropriate
component runbook. Custody remains a single writer; public API scaling does not
authorize scaling the writer. A machine restart is not a recovery strategy for
an uncertain publication result.

### Fly signaling

Check the API/runtime bindings and frontend protocol compatibility before
updating signaling. Rooms and chat use process memory. Follow the reviewed
maintenance conditions and check active Rooms before a restart. An empty Room
count does not by itself authorize deployment. Preserve the configured single
signaling machine until shared-state scaling has been implemented and accepted.

## Validation checklist

1. Verify the candidate's required checks. Use the
   [quality-gate guide](dev-quality-gates.md) and the workflow at the reviewed
   commit; distinguish failed, skipped, pending and passing checks.
2. Compare the reviewed configuration with the applied settings without
   exporting secret values. Confirm the affected service/image identities and
   served Web/Product build, not just a successful deployment command.
3. Verify health and readiness through the component procedure. Check the
   catalog and expected release visibility where relevant. A healthy API alone
   does not prove publication, key delivery or audible playback.
4. Run the affected user journeys: publication and wallet approval, free/paid
   access, disconnect, existing-release playback, or Room joining. Use existing
   content unless the reviewed operation includes a new publication.
5. Record devices, Host/browser versions, outcome and unresolved limitations in
   a dated evidence file. Record timeouts and unknown outcomes explicitly;
   never turn a missing observation into a pass or retry an uncertain write.

### Playback synchronization verification

For Room changes, use [the synchronization procedure](../explanation/room-playback-synchronization.md).
Test late join, pause/resume, seek, track change and reconnect with actual host
and guest clients. Check silence on pause or stale state and sound after explicit
resume. Include foreground, locked/background and relay-only paths when they
are in scope. Browser automation does not establish physical-device audibility
or acoustic synchronization.

## Rollback and uncertain state

Prepare rollback in the component review before delivery. Restoring an old image
must not discard admissions, nonce reservations, receipts or retained encryption
keys. A binary that cannot read the preserved state is not a valid rollback.
For the security candidate, reverting the API can also restore the revoked-key
race. Keep the correction when reverting an unrelated change. If a writer's
outcome is uncertain, follow its reconciliation procedure instead of repeating
the write or resetting state.

## Maintenance rule

Update this guide when configuration ownership, hosted surfaces or validation
steps change. Update the relevant reference when a variable or protocol limit
changes. Put release-specific facts in a dated rollout record, not at the top
of this procedure. Follow [Document a change](../how-to/document-a-change.md).

## Update checklist for future PRs

| Change                                             | Update or verify                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| Variable, secret ownership or origin policy        | Environment reference, relevant example/config file and component procedure |
| Mounts, state, scaling or rollback                 | Component runbook, source configuration and recovery checks                 |
| Protocol, errors or resource limits                | Socket/HTTP reference and relevant threat model                             |
| Product promise, roadmap or architecture narrative | Selected backlog sequence, README/public page as applicable                 |
| Delivery or device acceptance                      | Dated evidence with exact artifact identity and limitations                 |

## References

- [Documentation index](../README.md): choose a task.
- [Selected implementation sequence](../backlog/implementation/listening-and-publication-readiness.md): planned work.
- [Deployment history](deployment-configuration-history.md): preserved checkpoints and old section links.
- [Implementation and rollout evidence](../backlog/implementation/evidence/): detailed proofs.

<details>
<summary>Links from earlier release records</summary>

These anchors keep older links usable. Each entry leads to a historical
checkpoint, not an instruction for a new deployment.

<a id="w32-format-foundation-2026-10-20"></a>

[Historical checkpoint: w32 format foundation 2026 10 20](deployment-configuration-history.md#w32-format-foundation-2026-10-20).

<a id="shared-native-contribution-ledger-product-0140"></a>

[Historical checkpoint: shared native contribution ledger product 0140](deployment-configuration-history.md#shared-native-contribution-ledger-product-0140).

<a id="prepared-v2-publication-pipeline"></a>

[Historical checkpoint: prepared v2 publication pipeline](deployment-configuration-history.md#prepared-v2-publication-pipeline).

<a id="explicit-rpc-transport-prepared-not-deployed"></a>

[Historical checkpoint: explicit rpc transport prepared not deployed](deployment-configuration-history.md#explicit-rpc-transport-prepared-not-deployed).

<a id="generated-only-bulletin-mobile-diagnostic-not-deployed"></a>

[Historical checkpoint: generated only bulletin mobile diagnostic not deployed](deployment-configuration-history.md#generated-only-bulletin-mobile-diagnostic-not-deployed).

<a id="native-contributions-activation-2026-10-01"></a>

[Historical checkpoint: native contributions activation 2026 10 01](deployment-configuration-history.md#native-contributions-activation-2026-10-01).

<a id="room-contribution-activation-2026-10-08"></a>

[Historical checkpoint: room contribution activation 2026 10 08](deployment-configuration-history.md#room-contribution-activation-2026-10-08).

<a id="live-room-invitations-and-contribution-continuity-2026-10-18"></a>

[Historical checkpoint: live room invitations and contribution continuity 2026 10 18](deployment-configuration-history.md#live-room-invitations-and-contribution-continuity-2026-10-18).

<a id="publication-admission-preflight-candidate--2026-11-08"></a>

[Historical checkpoint: publication admission preflight candidate 2026 11 08](deployment-configuration-history.md#publication-admission-preflight-candidate--2026-11-08).

<a id="publication-and-room-follow-up-269"></a>

[Historical checkpoint: publication and room follow up 269](deployment-configuration-history.md#publication-and-room-follow-up-269).

</details>
