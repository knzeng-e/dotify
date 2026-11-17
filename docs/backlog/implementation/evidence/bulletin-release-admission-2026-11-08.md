# Bounded multi-release admission — 2026-11-08

## Identity and outcome

- Issue: #407. Branch: `feat/bulletin-release-admission`.
- Base: tested merged dev `98699bcd13ae3d14d2188d5d607962b94f2f6e9e` (#409).
- Implementation checked locally: `c83e6f2aadb7c38fbd03fcda49996280fbd845dc`; subsequent evidence-only changes do not alter code.
- Decision: [ADR 0046](../../../adr/0046-bounded-multi-release-admission.md).

The candidate admits successive release identities under one fresh explicit
artist/runtime/key-version policy and an aggregate cap. Audio/cover/metadata
share one durable whole-release allowance, while each part keeps its immutable
attempted-store/byte cap. Current deployed pilot admission is unchanged.

## Important proof

The synthetic integration composes the real StreamingJobs encryption/nonce path,
graph builder, publisher and receipt engine with a deterministic fake transport.
Two distinct audio/cover/metadata releases retain six inventories and one account
cursor. Wrong-owner admission, cross-release audio/cover substitution, edited
first metadata and a third release beyond capacity fail without another store.
It covers the current Studio's bare CID/path representation as well as exact
IPFS/protected-reference equivalents; arbitrary roots are never interchangeable.

Concurrent claims for one scope consume one allowance; distinct scopes race for
the remaining bounded slots. Completed, abandoned and uncertain claims stay
charged after process restart and queue cleanup. A known live writer permits another release to prepare through the atomic
allowance ledger; an unresolved account barrier blocks another release. Simulated post-inclusion response loss reconciles the same
ciphertext and sender/nonce receipts without encoding again or submitting any
CID twice. Metadata retries that only reconstruct `createdAt` reuse each release's
first bytes/root. Expired dependency retention stops metadata storage without
stores/renewals; stalled retention reads are bounded to two and cancel promptly.
An audio graph beyond its whole-part cap is refused even before opening a writer
session, so existing remote blocks cannot evade the graph-size bound.

Missing/changed admission history, changed normalized profile or unsupported
asset selection fails before signer loading. Old one-release profile bindings,
name repair, replay protection and storage recovery remain covered by regressions.
The writer/nonce engine itself is unchanged; only its scoped admission/composition
and matched cover identity are extended.

## Checks and limits of evidence

Local Node 22.13.1, macOS; dependencies reused from clean same-lockfile temporary
worktrees through untracked symlinks (excluded from commits). No live API, wallet,
artist file, key, Bulletin endpoint or deployment was used.

- API `npm test`: **353 passing tests**, including nine new admission/publication
  tests. Existing IPv4/IPv6 listener cases require local socket permission and
  pass with that permission; the sandbox-only EPERM run was not a product failure.
- API typecheck and production build pass.
- Web `npm run test:unit`: **1,106 tests / 145 files pass**.
- Five existing Chromium artist journeys pass: create/runtime/publish/catalogue,
  mobile My releases, upload failure, transaction failure and delayed catalogue
  recovery. These use synthetic wallet/catalogue fixtures, not actual Host signing.
- Web and frozen Product builds, formatting and lint pass. Existing warnings:
  two App.tsx effect dependencies, large bundles and dated Browserslist data.
- Backlog offline/live checks and diff whitespace check pass. PR CI remains the
  authority for the final source and full browser matrix.

## Next gate

Review the policy/ledger and composition, then prepare an inspectable migration
and activation proposal. Preserve the old queue, permanent encryption nonce
reservations, inventories/receipts, metadata sidecars, key-vault configuration and
all prior retained/attempted obligations. A fresh generation cannot simply point
at an already used vault with an empty nonce ledger. No automatic migration,
maintenance, profile rewrite, musical store, quota expansion or key transfer is
performed or authorized by this implementation.

Matched client rollout and a measured network/retention budget are required before
activation. Then actual artist wallet approval, catalogue readback, sound on
Web/Desktop, representative throughput and coherent off-volume restore remain
#407/public-pilot gates. The per-generation count is bounded, not an unlimited
public publishing service. Unused allowances are not automatically refunded; the
first cover/metadata are immutable within each admitted release. Generic editable
revisions and recurring conservation are not delivered here.
