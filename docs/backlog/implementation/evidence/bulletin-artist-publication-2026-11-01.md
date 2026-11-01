# Bulletin artist publication composition — 2026-11-01

Base: tested `dev` merge `05bddc18780ab404c30e687ca055a8729700fa64` (#371).
Scope: #288 / W33, with #287 / W32. This is application code and offline proof,
not a deployment, new network canary, quota increase or artist release.

## Delivered

The existing custody queue now selects Pinata or Bulletin explicitly. Bulletin
uses a private profile/account binding, a process lifetime lock, a read-only
startup check before opening a private seed, and a new bounded client per job.
The canary and application share the same PAPI 3 writer and receipt observer.
The default Pinata/edge startup does not load the PAPI writing SDK.

Per-job submission accounting remains durable across attempts. The application
also retains renewal allowances for earlier graphs and externally declared
obligations. It prevents discard and expiry pruning of ciphertext that may be
needed to reconcile a prior store. Existing wallet-signed upload authority,
release-bound key derivation, artist runtime signature and canonical access
checks remain in place. Covers and metadata still use Pinata.

## Local verification

- Full API suite: **286 tests passed**, including existing media/access tests
  and the new profile, signer, exclusive ownership, reserve and cleanup cases.
  Local ephemeral HTTP listener tests required execution outside the filesystem
  sandbox; no live signer or Bulletin writes were used.
- Production API typecheck and compiled build pass. The Web production build
  also passes with the existing large-chunk warnings; this slice changes only
  preparation recovery copy on the frontend.
- Shared writer/pipeline suite: **34 tests passed**. Its new quota case checks
  that the prior renewal floor prevents subscription/submission when exhausted.
- Protected rehearsal: **8 tests passed**, now using the actual application
  publication factory, queue, encoder, encryption and Host/Web reader services.
  A lost acknowledgement is reconciled with the same ciphertext and encryption
  nonce history. Entitlement, revocation, stale state, inactive release and room
  guest cases exercise the existing signed-key boundary. Storage/RPC/catalog
  responses remain simulated and outbound network use is forbidden.
- Upload-route/app boundary subset: **30 tests passed**, including an explicit
  recovery-required discard response and rejection of an edge writer or an
  implicit provider switch.
- Frontend preparation tests: **5 tests passed**; the retry-limit text directs
  recovery to the operator instead of promising a safe forced reset. Targeted
  ESLint and formatting checks pass.

The PAPI umbrella package adds its unused CLI transitively. An exact
`write-package -> deepmerge-ts@8.0.0` override removes its newly introduced
recursive-merge advisory. No unrelated dependency versions were upgraded;
`ws` is explicitly pinned to the previously tested 8.22.0. The install audit
still reports five existing high advisory groups (Fastify/busboy/URI parsing,
Sharp and Zod). Their broader upgrades are not claimed by this PR and remain
separate maintenance work. The custody app does not invoke the SDK CLI.

Final CI results are recorded in the linked PR checks.
No hosted state, secret, account allowance, contract, domain, gateway or DotNS
record was changed. Tests use generated local keys only.

## Remaining acceptance

Review the [design](../../../adr/0043-bulletin-artist-publication.md) and
[operator steps](../../../operations/bulletin-artist-publication.md), provision
fresh private state and a deliberately scoped signer, then calculate/approve
an exact short real-runtime protected test. Validate publishing and signed
access on Web and physical Host before switching the internal catalogue.

The existing five-minute publication window, three job attempts and full-graph
memory bound are unchanged. No representative multi-minute artist upload has
been measured through this composition. Automatic renewal, off-volume recovery,
cost/retention acceptance and protected physical listening remain open. Local
quota floors do not reserve resources on-chain or renew content automatically.
