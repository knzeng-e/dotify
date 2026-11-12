# Development toolchain verification — 2026-11-12

Implementation: `1084bdc149ea4ff25fae0d4793736bff989b6570`, based on tested dev
`c6e6fea8f237ba754bf388f0ba1022f064dc895b`.
This is local candidate evidence on macOS, Node 22.13.1. No runtime service,
wallet, music, key, admission or deployment was changed.

## Results

- All 1,143 unit assertions in 148 files pass with Vitest 5.1.0. Initial migration
  failures identified non-constructable arrow mocks and overly narrow helper
  types; only those test doubles/types changed, without deleting assertions.
- Web and frozen Product builds pass. Existing large-chunk warnings remain;
  successful compilation does not prove mobile performance or listening.
- Lint passes with the two existing App hook-dependency warnings. No rule was
  disabled or warning suppressed by this change.
- All 27 offline deployment/environment/identity guard tests pass, including
  the existing async/sync PAPI dependency probe and the new actual parser
  allowlist/type-information probe. PAPI CLI help starts without a chain call.
- Full Web `npm audit` (including development dependencies) reports zero known
  advisories at this date, compared with ten findings before the change.
  This is scoped to the Web lockfile, not all repository packages or future
  advisories. API Zod remains the separate #432 candidate.
- Production SDK, Host, signer and TrUAPI versions are unchanged. Shared build
  leaves sourcemap-codec/tinyglobby also advance through Vitest's required graph.
  ESLint's ordinary minimatch v3 remains separate from the parser's v11 override.
- Offline backlog and diff checks pass.

## Remaining gates

Exact-head CI, including minimum Node 22.12.0 Web checks and maintained Node22
Product/browser coverage, remains before review readiness. The change adds no
new public capability and does not require a service rollout. It makes no claim
that phone audio/locked-screen acceptance or independent backup recovery is done.

See [the dependency boundaries](../../../reference/development-toolchain.md)
and [#433 scope](../../tooling-security-migration.md).
