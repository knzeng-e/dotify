# Refresh the Node 22 server runtime

- GitHub issue: [#449](https://github.com/knzeng-e/dotify/issues/449).
- Priority: P1. Track: Production spine. Phase: Next. Type: Work.
- Local scope: `docs/backlog/server-node-runtime.md`. Project 5 owns workflow status.

## Problem and scope

API, isolated encoder and signaling images still select Node 22.13.1. This is
outside npm audit’s dependency graph. The official Node 22.23.5 security release
and Bookworm-slim image provide a same-major update without changing artist
access, keys, publication formats or Room behavior. No exploitable Dotify incident
is asserted. See [the runtime reference](../reference/server-runtime.md).

This is a local code/image candidate alongside #432/#433, not a live rollout.
Keep #407 publication/recovery, #395 startup, #388 artwork and CASH in their
selected delivery order. Retain older runtime observations as dated evidence.

## Acceptance

- Pin API build/runtime, encoder and signaling to the reviewed Node 22.23.5
  Bookworm-slim multiarchitecture index; preserve UID 1000, read-only code,
  graceful signals, encoder isolation and existing state/access/key semantics.
- Exclude private operator archives and local CLI credential directories from
  API/Web build contexts, verified by a generated Docker canary rehearsal.
- Align preferred local Node and fixed-version research/rehearsal jobs. Distinguish
  package/tool compatibility minimums from a secure runtime recommendation.
- Verify official arm64/amd64 manifests, local image identity/version/UID, API
  crypto/signature/HTTP behavior, generated non-root recovery and real AAC
  encoding rehearsals. Record architecture and exact source/image with results.
- Record the owner-confirmed generated second-Mac rehearsal honestly: it used
  the earlier reader, not this updated runtime, and included no real data/keys.
- Keep real data/key provenance, retained release coverage, service rollback,
  physical listening/locked-screen behavior and hosted capacity open in #407.

## Operational boundary

No live read, key export, deployment, restart, chain write, budget change or new
release is part of this candidate. A later rollout needs compatible image, UID,
configuration and state readback under separately reviewed maintenance. Do not
reactivate a writer from a data-only reconstruction or infer secret custody from
a generated authentication result. #432/#433 remain separate review prerequisites
for the eventual combined image.
