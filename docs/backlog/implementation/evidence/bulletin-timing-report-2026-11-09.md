# Offline publisher timing analysis, 2026-11-09

Refs #407. Candidate from merged dev `03905849` after #420; source tree matches
reviewed/tested `bd2e1dfc`. Production remains custody `ec8e82ae`, Web/Product/API
0.1.82. This candidate does not deploy or perform a publication.

## Why this slice

#418 is delivered, but no fresh full-publication timing is established. Read-only
inspection finds both audio jobs ready (175 blocks each), two claimed identities
and one missing metadata claim. That part retains its original maximum of four
attempted transactions / 64 KiB. Claimed identity count is not spent bytes.
The owner cannot find its browser draft, still has the original audio/cover,
and points out that the same source also appears in the latest release. A
read-only owner/runtime/hash check at 22:38:26 UTC finds the expected runtime
and no registration at finalized block 15,544,559 or latest block 15,544,573.
The fresh catalogue has the same source under the other artist/runtime. These
are different release identities; finishing this part would create another
release of the same audio. No duplicate is proposed just to obtain a timing
sample. Full raw results remain private; these observations are not a later
registration preflight or permission to publish.

For a genuinely useful release, a metadata-only sample may identify a transaction-stage cost without
another audio upload to Bulletin or changing admission. It cannot replace a
fresh full-audio measurement, and no such sample has been collected by this
candidate. The selected #407 → #395 → #388 → #406 → #408 order remains intact.

## Tool and trust boundary

The [operator runbook](../../../operations/bulletin-artist-publication.md#collect-publisher-timings-offline)
describes `services/api/scripts/summarize-bulletin-timings.mjs`. It frames bounded
JSON/pretty Fly log objects, unwraps the application JSON once, recognizes the
fixed timing schema and copies only known numeric counters, kind/outcome and
observation time. Job IDs become local ordinal labels; raw identifiers, errors,
provider fields and arbitrary log attributes stay out of output. No network or
environment-selected provider/signer is imported. The script is outside `src`
and excluded from the runtime image.

The report binds the source text by digest. Private-file/ownership/link checks,
a bounded read with change detection and exclusive output prevent accidental
log disclosure or overwriting an existing file. Validation errors are fixed
messages without arbitrary paths/payload. There is no write to custody journals.
The result is diagnostic, not proof of a receipt or new permission.

Each log observation remains separate, including duplicates. `elapsedMs` is a
publisher-attempt clock. Nested/concurrent phase sums may exceed it; missing
milestones and in-flight work remain explicit. No full-publication time, ETA,
percentage allocation or bottleneck verdict is invented.

## Reusing preparation through a new form

An added regression exercises a ready job across process restart with admission,
key derivation, authority callbacks, encoding and publication disabled in the
fixture. The exact owner/scope gets the same ready result and byte-identical
queue/nonce ledger; different identities are refused without state changes.
This verifies existing queue reuse, not new browser-draft restoration or an
access bypass. The real HTTP route still verifies signed upload authority and
source hash; selecting the source transfers bytes to the API. Exact cover reuse
also depends on retaining the original file/graph.

## Validation and remaining gates

- Eleven analyzer cases cover real Fly framing, overlapping/failed/in-flight
  reports, duplicates, filtering/pseudonyms, bounded or malformed inputs, private
  files, symlinks/hardlinks, UTF-8/BOM digest, exclusive output and CLI privacy.
- The new ready-job regression covers restart reuse and identity isolation.
- Full API suite: **390 tests passed**, 42 suites. The unrestricted local run
  permits the HTTP/socket cases denied by the sandbox; no test uses production
  artist files, keys or network writes. API typecheck/build, formatter, local
  documentation links, whitespace and offline backlog checks pass. An archived real Fly log with no timing event correctly refuses
  without creating output; it supplies no latency sample.
- Canonical/catalogue identity inspection is complete at the heads above; a
  useful owner-driven publication, actual timing samples and full-publication
  latency remain acceptance gates.
  No policy/key/queue reset, maintenance, new quota or admission is performed.
