# Verify a deployment configuration

Use this guide when preparing or reviewing a Dotify Web, Product, API, custody,
encoder or signaling delivery. It identifies what to compare and what evidence
to retain. Component runbooks contain the actual publication and maintenance
procedures; this guide does not authorize or execute a delivery.

## Native price and NFT removal (#493)

The [#493 candidate model](../reference/native-price-without-nft.md) changes
creation bytecode, registry storage/getter/event ABI, bootstrap stages and catalog
fields. Deliver it only as the selected matched fresh generation, after the
remaining audit corrections and authorized cutover. Do not update the API or
clients against earlier contracts and do not install this registry over old state.

Before a signing/deployment command, set `DOTIFY_NATIVE_TOKEN_DECIMALS` to the
verified native Balance precision (0..18). For the 10-decimal native preset,
use `10`, not the EVM currency metadata's `18`. Keep the value in the reviewed
plan and deployment manifest; finalized factory readback must match. Verify a
new artist runtime reports the same `musicRegNativeDecimals()` and the Product
adapter agrees. Missing or mismatched precision must stop publication/signing.

Read back the new NFT-free selector inventory and record ABI, absent ERC-721
interface, seven installation calls and bound artist/administrator roles. Check
minimum valid Classic price, a refused nonrepresentable price/edit, exact price
display and real native settlement/access through both writers. Local EVM tests
are not Revive weight, recipient-settlement or physical Host acceptance.

Regenerate API/Web ABIs, Product CDM bindings and candidate metadata from the
same compiler artifacts. Replace finalized CDM versions/addresses only during
the separately authorized fresh publication/readback. The retained earlier CDM
snapshot is historical evidence, not a compatible NFT-free deployment. Existing
secret custody, receipt history and nonce preservation duties remain; no CORS,
mount, scaling or frontend-secret settings change in this source scope.

## Personhood reader (A06)

The [supported-evidence policy](../reference/personhood-status-policy.md) changes
Access/Royalties bytecode while preserving ABI, storage, context and address.
Include the corrected facets in the matched fresh generation; no environment,
secret, CORS, mount or scaling setting changes in this source scope.

Before presenting HumanFree as available, verify the target runtime exposes the
expected precompile and exact declared response ABI, then retain commit-bound
readback for known None, unavailable and unsupported/malformed evidence where
the target test environment permits it. Confirm supported DIM1/DIM2 proof and
address/context binding through the intended chain/Host. Local mock success
must not substitute for real-proof or physical-device acceptance. Record
unavailable capabilities as remaining gates; never enable a manual fallback.

## Paid release access (A05)

The [A05 candidate](../reference/paid-release-access.md) changes Access facet
bytecode and the paid-access promise, with unchanged ABI and storage. Include
it with the owner-selected matched fresh contracts/API/clients. Do not deploy
the new payment copy against an old facet that rejects earlier buyers under
HumanFree. Verify exact candidate code/facet routes rather than ABI shape alone.

In a separately authorized acceptance exercise, bind one actual purchase receipt
to its chain/runtime/release/wallet, then verify active HumanFree access without
personhood, independent unpaid denial, deactivation denial and reactivation
without another payment. Verify signed individual/Room-host key delivery only
with finalized/current positive authority, and denied anonymous public keys.
Local mocks are not Revive settlement, real proof or physical Host acceptance.
No new environment variable, secret, CORS, mount or scaling change is required.
There is no old-generation import, refund mechanism or deployment in this scope.

## Directory pagination (A08)

The [directory page candidate](../reference/contracts-api.md#directory-page-bounds-a08)
changes `ArtistDirectory` bytecode, with the same ABI and storage layout. The
directory is not a runtime facet and cannot be upgraded through `diamondCut`.
Include the corrected directory and its bound factory in the selected matched
fresh generation. No old-state import or deployment occurs in this source scope.

During separately authorized readback, verify the directory/factory binding,
registration-order pairs, zero/end offsets and a large-limit call. Retain a
complete multi-page read at one confirmed block; API/Web request 50 and Product
configuration must stay in 1..100. Existing per-runtime and indexing budgets
remain independent. No new environment variable, credential, CORS origin,
storage mount or scaling change is required. Local Hardhat tests are not native
provider cost or physical Host acceptance.

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

At the [2026-11-13 delivery checkpoint](../backlog/implementation/evidence/product-0.1.83-rollout-2026-11-13.md),
Web/Product serve 0.1.83. Independent Web/object/finalized-DotNS reads pass;
custody restarts once with its unchanged #426 image/configuration, protected
state and two health/readiness passes. This client operation replaces no server
image or key and activates no compact publication. Phone acceptance remains open.

At the [2026-11-14 delivery checkpoint](../backlog/implementation/evidence/product-0.1.84-rollout-2026-11-14.md),
Web/Product serve 0.1.84. Complete byte/record readback and unchanged custody
health/history pass after one same-image restart. The public API still identifies
the 0.1.82 source. The owner accepts the requested short phone Pause/artwork/guest
checks on Polkadot app 0.10.0 (20); extended listening, server-side security fixes
and compact activation remain separate gates. No image, key or musical policy
changes in this application-only delivery.

At the later [server checkpoint on 14 November](../backlog/implementation/evidence/service-security-rollout-2026-11-14.md),
the API pair, custody, encoder and signaling run the reviewed source `91f25c77`
on Node 22.23.5. Registry/image, health and retained-state checks pass. Existing
settings and keys are preserved; Web/Product remain 0.1.84. Listening/Room
acceptance after this server change remains open. No compact/CASH activation,
musical upload or chain operation was performed.

At the later [0.1.85 client checkpoint](../backlog/implementation/evidence/product-0.1.85-rollout-2026-11-14.md),
Web/Product deliver the bounded Free-track buffering/Room-timeout correction from
`02ae5b31`. Complete artifact/Web/finalized-DotNS readback and same-image custody
restart/history checks pass; the `91f25c77` server images and settings are retained.
The owner reports continuous solo and successful-retry Pause/guest/short-lock
sound on Polkadot app 0.10.0 (20), but the first Room opening still times out at
about one minute / displayed 99%. Initial no-retry startup and measured latency
remain open. No musical policy, key, compact or CASH activation occurs.

At the [0.1.86 client checkpoint](../backlog/implementation/evidence/product-0.1.86-rollout-2026-11-14.md),
Web/Product deliver queued Room ciphertext reuse from `61f4a452`. Complete
artifact/Web/finalized-DotNS readback and same-image custody restart/history checks
pass; server images/settings stay `91f25c77`. One matching phone first-opening/
Pause/guest/short-lock check passes; slow/repeated startup remains open.
No musical allowance, key, compact or CASH activation changes.

At the [0.1.87 client checkpoint](../backlog/implementation/evidence/product-0.1.87-rollout-2026-11-15.md),
Web/Product deliver complete-read Room scheduling from `1d3ce028`. Independent
artifact/Web/finalized-DotNS readback and unchanged custody restart/history pass;
server images/settings remain `91f25c77`. One matching phone opening/Pause/guest/
short-lock sound check passes, but preparation takes 36.955 s and the lock-screen
cover is absent. Latency and artwork acceptance remain open. No musical
allowance, key, compact or CASH activation changes.

At the [0.1.88 client checkpoint](../backlog/implementation/evidence/product-0.1.88-rollout-2026-11-15.md),
Web/Product deliver optional local transport-phase counters from `4cbdb4f4`.
Independent artifact/Web/retention/finalized-DotNS and unchanged custody restart/
history checks pass; server images/settings remain `91f25c77`. One matching Wi-Fi
phone opening/Pause/guest-lock/artwork check passes; preparation remains 34.857 s.
The phase report guides further diagnosis, without a latency-gain or artwork-fix claim.
Older 0.1.87 reports cannot provide these new fields retrospectively. Follow the
[measurement guide](../how-to/measure-room-startup.md#distinguish-transport-phases).
No setting, musical allowance, key, compact/CASH or automatic renewal changes.

At the [2026-11-16 API cache checkpoint](../backlog/implementation/evidence/api-cache-rollout-2026-11-16.md),
both public API replicas serve `72e28eba` with the 128-entry / 16-MiB IPFS cache.
Exact image/source, preserved stable/launch configuration and health/readiness
checks pass after sequential replacements. Only the image and public source
marker change. Custody, encoder and signaling are not targeted; Web/Product
stay 0.1.88. Later phone feedback has an initial timeout followed by successful
retry/later opening; Pause and guest sound are reported OK. Reliable initial
startup and hosted cache/memory acceptance remain open; no controlled speedup
is claimed.

Do not infer an active key, remaining publication allowance, available quota or
permission to reuse an admission from this page. Use the applicable private
review package and component checks; preserve existing receipts and history.

The [development-toolchain candidate](../reference/development-toolchain.md)
requires Node 22.12+ within major 22 for future Web/Product builds. Verify the
hosted build runtime against `web/package.json`; the source change does not
update a Netlify dashboard, server image or deployment.

## Hosted surfaces

### Artist authority candidate (#490)

[The A03 role model](../reference/runtime-artist-authority.md) requires a matched
fresh SmartRuntime/factory/initializer generation and all six ownership selectors.
The runtime constructor now takes an independent artist argument. After staged
artist-signed completion, read back `runtimeArtist == directory artist`, readiness
via successful artist publication, `owner == artist` and zero pending owner.
Subsequent administration delegation requires explicit pending acceptance.

Regenerate Web/API ABIs from the compiled artifacts. The API now checks the
runtime artist in finalized/current state for uploads and keys; missing getters
fail closed. Do not ship this API ahead of compatible contracts or use a
one-selector legacy facet hotfix as migration. Deploy/activate only through the
owner-selected fresh-generation procedure after remaining audit corrections.
No new environment variable, mount, secret, origin or scaling is introduced.

Before activation validate actual Revive creation/resource bounds, recipient
acceptance/cancel, normal artist publication and profile gifts after delegation,
historical paid access and matched API/client behavior. Upgrade administration
still permits arbitrary code and is a trust boundary. Source tests do not
perform a deployment, artist-identity migration or active-state reset.

### Finalized key authority candidate (#488)

[The A09 policy](../reference/finalized-key-authority.md) requires true finalized
block observations and EIP-1898 canonical historical reads on every configured
primary/fallback EVM endpoint. There is no latest/confirmation-count fallback.
Accept the exact Revive provider behavior before delivery; an unsupported or
unavailable finalized view denies new keys. No RPC switch, new variable, mount,
CORS origin, secret or scaling change is made by this source correction.

Deliver matching API/client artifacts so `ACCESS_PENDING_FINALITY` offers retry
without another unlock/payment. Validate an unfinalized-only entitlement denies,
a finalized entitlement grants only while current policy permits it, and a newer
deactivation blocks it. Exercise signed/session/Free/queue/Room-host requests,
RPC outage, cache changes and retry without paying again. Observe the extra
cold proof work and hosted quotas before claiming first-sound acceptance.
Already delivered keys are not recalled. Contract, key/nonce and receipt formats
do not change, so no state migration/reset is required by A09. Rolling the API
back restores the prior latest-only disclosure risk and is not a secure fallback.
The fresh-generation procedure below remains separate after other audit fixes.

### Catalogue runtime isolation candidate (#486)

[The A01 source candidate](../reference/catalog-runtime-isolation.md) adds optional
schema-1 runtime exclusion diagnostics and bounded artist reads. No environment
variable, mount, origin, secret or scaling change is introduced. It is not
recorded as deployed or native-accepted.

For its later delivery, quiesce catalogue writers, retain a paired base/checkpoint
backup (or the shared namespace backup), and install matching API writer/reader
artifacts on every replica before resuming indexing. An older binary ignores
runtime diagnostics and must not remain an elected writer. Force a confirmed
reindex with the matched version, then verify healthy releases, exclusion count,
full diagnostic persistence, global-RPC failure metadata and denied keys for an
excluded runtime. Confirm fresh healthy key checks still read directory/track/
access independently. Repeat after reader restart and writer handover.

On rollback, quiesce writers and force a coherent reindex before allowing keys;
do not let an older writer use a filtered snapshot as a complete inventory.
Never delete protected key/receipt state to repair a catalogue diagnostic. Exact
Revive resource-budget acceptance remains a deployment gate. The owner-selected
fresh-generation reset below remains a separate reviewed operation after all
required audit fixes; this source change does not perform it.

### Native payment correction candidate (#484)

The [20 November core checkpoint](fresh-testnet-2026-11-20.md) records the new
eleven-transaction testnet deployment, finalized bytecode/binding checks and ten
explorer source verifications from `dev` `146fb446`. The
[21 November checkpoint](fresh-cdm-2026-11-21.md) adds finalized Bulletin metadata,
exact CDM version 4 and matching source manifests. Hosted services and clients
have not switched; the old custody publisher is stopped. This is not activation
or native value-flow acceptance.

For the owner-selected 20 November preparation after merged SDK #483, follow
[Prepare a coherent fresh testnet generation](../how-to/prepare-fresh-testnet-generation.md).
New factories now require `metadataPallet` and use seven install/finalize calls
after creation. Read-only plan/readback commands require the explicit public
`DOTIFY_DEPLOYER_ADDRESS`, alongside verified `DOTIFY_NATIVE_TOKEN_DECIMALS`;
they do not need a signer. The v2 readback verifies exact code/bindings and the
recorded CDM versions, including versions above seven. These are candidate tools,
not evidence of API/client delivery. The tracked CDM/deployment records now bind
the finalized fresh core; a client using them still requires a coherent hosted
generation or an explicitly identified qualification context.

The owner selected a **complete fresh testnet generation on 18 November 2026**.
The old contracts, releases, references, purchases, NFTs and pending test balances
are abandoned as active application state. This replaces the earlier facet-only
migration plan for [the payment correction](../backlog/native-payment-settlement-parity.md).
The core checkpoint above begins this procedure; active-state cutover and
new-generation acceptance remain ahead.

1. Finish the system-audit corrections and freeze a tested source commit before
   preparing deployment transactions. Review a versioned manifest for the fresh
   directory, factory, initializer, facets and artist runtimes, with chain ID,
   compiler settings, addresses and bytecode hashes. Include the default metadata
   implementation; royalties already includes the contribution selectors.
2. Prepare a coherent new active scope across contract configuration, API
   catalogue/checkpoints, native receipt history, client bootstrap/catalogue and
   runtime-bound release/key references. Provision clean generation-specific
   journals/queues and retire old active jobs, admissions and saved receipt
   lookups. Preserve dated audit evidence separately. Old on-chain/storage
   objects are not claimed to be deleted. Do not replay old pending writes or
   reset a reused account's chain nonce.
3. Deploy and read back the new manifest before switching its references. Keep
   one custody writer, `PASEO_ASSET_HUB_NATIVE_RPC`, `DOTIFY_CHAIN_ID=420420417`
   and durable `NATIVE_CONTRIBUTION_SNAPSHOT_PATH`; bind its active history to
   the new generation. The version-1 schema can retain both contribution and
   royalty events. Its path belongs on the custody volume, not an edge filesystem.
4. Deliver matching custody/edge receipt endpoints before enabling clients.
   Edges proxy `/api/payments` and `/api/royalties` with contribution routes.
   Verify royalty-history reads and reject caller-supplied logs/targets at
   `/api/payments/native-receipt`. Keep API/RPC configuration coherent and
   publish fresh Bulletin releases with new runtime-bound identities and keys.
   No new environment variable, CORS origin, mount type or scaling is introduced
   by the payment code itself; exact fresh state paths/configuration still need
   a reviewed deployment manifest.
5. Verify native payout, failed-recipient claims, refund isolation and maximum
   fan-out on the exact target Revive artifact. On physical Product Host, verify
   finality, beneficiary balance, receipt links, API outage/reload/sync repair,
   and pre-submit storage rejection. A post-finality storage failure must retain
   the hash/block and continue balance/access verification, with a separate
   history warning. Never repay merely to repair history. Accept publication,
   solo/Room listening, track changes and lock-screen artwork against the new
   release generation. SDK #483 and CASH keep their separate compatibility gates.
6. Back up the new generation's expanded receipt journal before delivery and
   retain it across rollback within that generation. Roll clients and APIs back
   coherently; do not restore an empty journal or silently reconnect the new
   client to the abandoned generation. Old-testnet debt migration is not required.

### Testnet cutover with an interruption

The owner-selected development cutover accepts a maintenance interruption.
Archive the empty-directory finalized core/CDM readback before artist onboarding.
Creating the runtime calls the new factory through the artist's wallet and does
not require a publication API. Bind the publisher to the actual completed runtime
before starting custody. The [procedure](../how-to/prepare-fresh-testnet-generation.md#review-one-contractapiclient-configuration)
owns this sequence; the existing publisher startup preflight remains mandatory.

Drain active work and stop all old writers before the final state capture.
Preserve session epoch/revocations, live auth nonces and upload reservations/usage
in the new PostgreSQL namespace during one operator transaction, retaining the
old namespace as evidence. Do not import its catalog/checkpoint or old receipt
lookups. Explicitly adapt and verify runtime row policies for the new namespace;
the deployed `dotify`-only policy does not admit another name. Keep one custody
owner, protected volume backups and all nonce/key/retention history. Retiring a
release does not replenish storage or upload budgets.

After artist-wallet creation and finalized runtime readback, prepare its unused
content-key domain and bounded Bulletin policy, preserving every previous secret
and account obligation. Start one matched custody with its normal preflight,
then matching edges and signaling against fresh receipt/catalog paths and the
new shared identity. Freeze the actual new-generation API catalog for the
identified Web/Product delivery. No releases are expected yet; any indexed
artist must belong to the new directory. The earlier empty-artist observation
remains a pre-onboarding checkpoint. If startup fails, keep the affected service
stopped and reconcile its configuration and journals. No recurring renewal or
musical allowance is granted by this procedure.

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
are implemented by the server build recorded above. Source alone is not proof
of any later hosted state. The [#432 validator reference](../reference/api-schema-compatibility.md)
requires coherent retained state and shared-state/publication checks for future
deliveries; no journal reset or admission change is implied.
Development-tool advisories
are tracked in [#433](../backlog/tooling-security-migration.md).

The [compact delivery candidate](../reference/bulletin-compact-delivery.md) adds
an explicit reference, catalogue-gated ciphertext path and exact-source ledger
version. It adds no environment variable or active allowance. A later delivery
must match Web/Product/API/custody and preserve all retained keys and state;
older binaries cannot interpret the new ledger/reference. The
[loopback AAC gate](dev-quality-gates.md#compact-aac-acceptance) uses test-only
ports 5293–5295 and injected synthetic data, not hosted settings. Physical-device,
coherent off-volume restore/rollback and memory gates remain before activation.
The [prepared-job recovery extension](bulletin-prepared-job-recovery.md) adds no
CLI flag or setting, but requires a reviewed compatible custody binary and a
fresh inspect/execute plan during separately arranged maintenance. Existing
claims, key versions, admission archives and nonce/account journals must remain
available; no running service is changed by this source candidate.
The [generated restore workflow](bulletin-generated-restore-rehearsal.md) uses
public fixtures and disposable CI runners, with seven-day artifact retention.
A third runner builds the candidate and two fixed historical revisions with their
own lockfiles for [compiled-module compatibility](bulletin-generated-restore-rehearsal.md#compare-compiled-historical-versions); it does not start a deployed service/image.
It changes no Fly mount, secret, backup job or production recovery configuration.
The [resource-envelope exercise](bulletin-resource-envelope.md) uses the unchanged
API/encoder images on an internal Docker network, with 1-GiB/512-MiB cgroups,
no swap and generated 97/900-second profiles. Its temporary settings are never
Fly/Netlify environment variables; no service capacity or hosted load is accepted.
The [data-only checkpoint CLI](bulletin-custody-checkpoint.md) needs separately
arranged stopped-writer maintenance, private canonical paths and a reviewed
compiled revision. It adds no environment variable, transfer, key export or
restore. Actual storage independence and key recovery remain unaccepted; no Fly
mount, secret, backup schedule or service configuration changes here.
The [isolated reconstruction CLI](bulletin-isolated-restore.md) adds private
review directories and permanent binding barriers, not a service restore, key
installation or new setting. Its saved profile paths are metadata only; a future
operational restoration still needs compatible images/UID/mounts, separately
recovered keys and current canonical history.
The [offline recovered-key checker](bulletin-recovered-key-check.md) reads only
an explicit private recovery file and guarded workspace. It introduces no hosted
secret/setting or automatic key export, rotation, transfer or service activation.
The planned second-Mac rehearsal still needs reviewed data/key destinations,
transfer method and stopped-writer scope.
The [published-graph archive CLI](bulletin-published-archive.md) captures one explicit root with an explicit read-only HTTPS source, then verifies offline. It adds private local artifacts, not hosted settings, credentials, a public archive route or a scheduled backup. Custody checkpoints, recovered keys and canonical-history validation remain distinct.
Source availability is not a deployment or permission to apply an extension.

The browser harness alone sets `DOTIFY_E2E_LOCAL_FONTS=true` on its local Vite
dev server to remove external font links. This is not a `VITE_*` runtime flag;
it has no build effect and belongs in neither Netlify nor Fly settings. See
[browser font isolation](dev-quality-gates.md#browser-font-isolation).

## Prepare the affected components

### Netlify frontend

Use the reviewed branch/commit and the existing project's settings. Build-time
`VITE_*` changes require a new build; editing the dashboard does not change an
already served bundle. Confirm the build and publish paths against
[netlify.toml](../../netlify.toml). Keep frontend secrets out of all contexts,
including deploy previews.

For a client change involving covers, verify the
[public-artwork cache boundary](../reference/public-artwork-cache.md): denied or
stalled Cache Storage must retain public-image delivery and must not restore
metadata after disconnect. Reopening a prepared cover must supply its PNG on the
first metadata registration without recomposition; another track using the same
cover must retain its own title/artist. This source candidate adds no hosted
setting or cache schema change. Native repeated lock/unlock acceptance is still
a device check.

### Product DevNet frontend

The [SDK 0.45 migration candidate](../design/product-sdk-045-migration.md) is not
promoted. Its install-time public-info workaround requires normal npm lifecycle
scripts (or its explicit manual patch command). Run `npm run test:product-sdk-compat`
after a clean install. Transaction validation requires a named Runtime 0.31.x
Host; a passing build on an older phone/Desktop is insufficient. Record native
PAS approval/receipt recovery and protected listening before promotion. This
candidate changes no hosted variable, network, storage or service setting.

The [20 November phone evidence](../backlog/implementation/evidence/product-host-ios-031-2026-11-20.md)
provides a build-23 / Runtime-0.31 configuration target. Use the
[qualification procedure](../how-to/qualify-product-host-031.md) for the initial
non-spending info record. Functional contract/media/payment acceptance must use
the audit's matching fresh contracts/API/client generation; the old ABI is not
an interchangeable validation target. Record the exact candidate artifact and
reviewed delivery context before requesting a device test.

The signer-free candidate workflow also runs the journey harness against the
reviewed SDK dependency family. Include its regressions in
`npm run test:product-deploy-environment`; keep missing device evidence blocked.
These automated checks establish source readiness only. Human review,
qualification delivery and stable promotion retain their separate gates.

Follow [Product publication](product-devnet-deployment.md) for package identity,
retention checks, budget, signer handling, readback and rollback. Record the
commit, app version and executable CID. A completed upload alone is not proof
that DotNS points to it or that the Host can run it.

### Fly backend API

For Node image updates, follow the [runtime selection and validation boundary](../reference/server-runtime.md).
A source pin is a build candidate; record the delivered image/version separately,
and preserve the existing UID, mounts, keys and historical state.

Determine whether the change affects public API replicas, custody, the encoder,
or several components. Do not replace one role's configuration with another's.
Check shared state, mounts, retained keys and readiness using the appropriate
component runbook. Custody remains a single writer; public API scaling does not
authorize scaling the writer. A machine restart is not a recovery strategy for
an uncertain publication result.

### Fly signaling

The signaling image installs only production dependencies with
`npm ci --omit=dev --ignore-scripts`. Its server/shared JavaScript runtime has
no frontend Host-codec consumer or installation-hook requirement; it does not
copy or run the frontend patch. Ordinary frontend installs still apply the
patch. The signaling CI gate now builds this image and verifies isolated
non-root startup/health before a delivery is eligible. No hosted setting changes.

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
or acoustic synchronization. For slow starts, collect successful and failed
[correlated support reports](../how-to/measure-room-startup.md) from the same
reviewed client build before changing timeouts or transport behavior.

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

The [published-audio authentication command](bulletin-published-audio-check.md)
is an explicit offline operator tool with separate private plan/key paths and
trusted digests. It adds no hosted route, environment setting, volume, secret
installation or startup action. Ordinary media still refuses original archives.
