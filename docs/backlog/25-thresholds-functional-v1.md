# 25 - Thresholds functional v1

## Sprint

Product experience - production-spine presentation and security hardening.

## Priority

P0 entry/listening slice. Later provenance, ambassador, and object work remains
blocked by the production spine and explicit consent/anti-abuse designs.

## Objective

Turn the selected `Thresholds` concept into a functional first slice without
rewriting the proven standalone domain:

- a room share link shows real host/work/presence metadata before entry;
- `Now` discovers live rooms without waiting for a navigation click;
- the visual hierarchy is warm, editorial, and spatial rather than a dark
  dashboard/constellation;
- paid denial is an honest closed door with no retired 42-percent preview claim;
- the invisible guarantees behind publishing, upload identity, and WebRTC relay
  are hardened and tested.

Full product, architecture, wireframe, security, accessibility, performance,
test, and phased-backlog rationale:
[`docs/design/dotify-thresholds.md`](../design/dotify-thresholds.md).

## Scope

### Entry and listening

- Load public room summaries when the listener shell mounts.
- Resolve the room targeted by `#/rooms/<roomId>`.
- Present its host, work, real presence count, room code, and wallet-free
  promise in the existing join dialog.
- Preserve the deliberate first-time pseudonym step and remembered-name
  auto-join behavior.
- Preserve the real Socket.IO/WebRTC path and listener no-key invariant.

### Presentation

- Add a separately reviewable `thresholds.css` layer loaded after the historical
  styles.
- Replace the app-wide galaxy/lights-down body mode with the Thresholds body
  mode while retaining track aura variables as real work identity.
- Use a warm matte canvas, deep-blue listening apertures, cyan actions, and
  restrained Polkadot pink.
- Remove the Constellation Stage/Sky from this direction; the finite catalog and
  literal room cards remain accessible.
- Retain all load-bearing e2e selectors and behavior.

### Security hardening

- Runtime-owner-only track registration plus outsider test.
- Server-side BLAKE2b-256 verification of uploaded audio plus mismatch test.
- Chain-domain binding for nonce, signature, session, and key-delivery paths.
- Same-room, verified host-listener authorization for WebRTC relay messages.
- Preserve all three access modes in signaling and remove protected source
  references plus declarative host wallet addresses from public room payloads.

## Acceptance criteria

- A first-time share-link guest sees the host and live work before joining,
  chooses a room name, and enters via `Enter and listen`.
- Live rooms load on `Now` without wallet or key-service activity.
- The deterministic room e2e still proves remote WebRTC audio and zero listener
  key requests.
- No user-facing source says `Preview - 42%` for a locked work.
- An outsider cannot register into another artist's SmartRuntime.
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

## Deployment blocker

The source-level owner check and outsider regression test are implemented, but
the configured Paseo factory still points to the previously deployed registry
pallet. Existing runtimes route the registration selector to that old facet.
The acceptance criterion is therefore local/test-level only until the factory
and directory are replaced **and** each existing runtime is explicitly upgraded
by its owner. No on-chain deployment is part of this ticket without separate
approval.

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

Current completion matrix:

- existing runtimes protected: `0/2`;
- existing tracks audited: `3/3` owner-matched;
- pending runtimes found: `0` at the audit block;
- corrected facet deployment: pending explicit approval;
- future factory/directory canary: pending;
- existing-catalog migration and active cutover: pending.

## Delivery notes

The functional slice and source-level hardening are implemented in the current
worktree. The ticket stays `In progress` because the deployment gate above is
not satisfied; no commit, PR, or on-chain mutation is part of this worktree
delivery yet.

Validation evidence (2026-07-12):

- web lint: 0 errors (3 existing hook-dependency warnings);
- web unit: 132/132, including production publication-quarantine gates and
  handler-level proof that blocked writes stop before wallet/upload side effects;
- signaling: 42/42;
- API: 64/64 plus typecheck and build;
- contracts/tooling: 44/44 plus formatting check, including task-level audit
  and finalized-manifest execution, a vulnerable-to-protected one-selector
  hotfix, state preservation, calldata
  shape, and stable plan digest;
- deterministic browser flows: 11/11, including delayed room resolution,
  unavailable links, and wallet-free guest boundaries;
- production web build, artist-quarantine browser smoke, and desktop/mobile
  no-overflow visual smoke: passed;
- live registry snapshot: completed read-only at block `10877675`; intentional
  exit code `2` while `0/2` runtimes and the factory remain unsafe. A final
  rerun of the stricter fail-closed task was blocked by the execution
  environment's network quota and remains an operator prerequisite;
- corrected-facet deployment task: Paseo dry-run passed; no transaction sent;
- repository diff whitespace check: passed.
