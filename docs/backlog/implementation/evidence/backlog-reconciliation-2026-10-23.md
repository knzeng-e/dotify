# Backlog reconciliation, 2026-10-23

Owner request: audit stale backlog issues, specifically #274 and #257.
Read-only source baseline: merged dev `a60a89fda4f62819ec2b7bb16c4d4c71bfe176b7`.
Inspected all **31 open issues**, all **72 repository issues**, the **250 Project 5
items**, the local manifest and up to 200 merged dev PRs, plus the original
stacked #258. GitHub Project 5 owns live workflow status; this is a dated
scope/evidence record, not a replacement board.

## Delivered scopes to close

| Issue                 | Reviewed evidence                                                                                                                               | Retained boundary                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #240 PR writing       | #241 merged; template and review guide present                                                                                                  | Documentation only, no deployment gate. Missing local manifest entry added.                                                                                                                         |
| #250 W29 clarity      | #249 and later recovery corrections merged; W29 evidence records actual checks                                                                  | Real-wallet chained sign-in and protected failure observations stay in #85/#158.                                                                                                                    |
| #257 room life        | #258 stacked into the merged connection branch, #261/#263; later #300/#304                                                                      | Code retains typing/replies/mentions/pin, live artist view and server-verified visits. Owner reported Web/EVM announced visit on October 11. Exact native/social/audio matrix remains #85/#89/#158. |
| #273 roadmap decision | #277/#295 merged                                                                                                                                | This records a decision already applied; #275/#276 and deferred watch items retain their own scopes.                                                                                                |
| #285 W30 hardening    | #296/#316; 0.1.58 rollout records real same-volume maintenance, backup, identical hashes, UID/GID 1000 and preserved session/custody continuity | Real-network/media and pilot load evidence remain #89/#158. Do not repeat ownership maintenance or restore an old revocation/nonce snapshot.                                                        |
| #320 legacy cleanup   | #321 merged and deployed with the 0.1.58 reset                                                                                                  | Current-format publication/audio acceptance remains #287/#317/#158. No migration of retired DAV1/DAV2 content.                                                                                      |

Closing an implementation record does not certify its broader pilot/native gate.
These six records move to Record/Done in the manifest and Project 5. No already
closed repository issue was found with an active Project status. Closed #210
has no Project card; delivery records do not require one under the local policy.

## Active scopes needing corrected descriptions

| Issue                  | Delivered facts                                                                                                                                                                          | Exact remainder                                                                                                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #274 W19               | #278/#279/#283/#298/#300/#304 deliver default Nearby/Worldwide galaxy, automatic foreground discovery, 5–42 km controls, compact overlays, exact session counts and host-intent recovery | Exact physical Host permission/fix/revocation and two-client Nearby discover-to-audio, lifecycle/expiry and privacy evidence. Keep open and In Progress, not a new implementation or a pending old PR. City exploration/manual-scan instructions are historical. |
| #286 W31               | #297 deployed; exclusive visibility, shared Hide/Report and lazy studio                                                                                                                  | Dedicated **Worldwide Report** E2E is still absent. Current `nearby.spec.ts` exercises reversible Hide, not Report. Keep open; do not equate those actions or implement a new feature during this audit.                                                         |
| #287 W32               | #312/#318/#321 and 0.1.58 deployed jobs/encoder/custody/authenticated playback                                                                                                           | Current-format real publication/pinning, native denial/playback/seek/host-guest, prolonged listening and upload/storage load. Old migration and provisioning tasks are no longer future work.                                                                    |
| #288 W33               | #325 merged; edge-first ciphertext, bounded warming, API/IPFS fallback                                                                                                                   | Dedicated gateway returned HTTP 401 in three authorized regional probes. Access/CORS/cache verification, activation and paired cold/warm audible measurements remain; origins stay unset.                                                                        |
| #317 reset             | Fresh contracts/CDM v2 and coordinated services/clients deployed; #323 bootstrap correction and #326 Host pairing merged                                                                 | Owner reports artist setup/publication working; this observation is not a complete candidate-bound audio/access/value-flow matrix. The old stage-7 blocker is resolved code, not a request to recreate the runtime.                                              |
| #269 release follow-up | #270/0.1.48 delivered original code/rollout; reset retired three old runtimes                                                                                                            | Actual new-runtime metadata capability/edit/read-back and coordinated tip/receipt acceptance remain. Fresh core registry audit alone does not prove an optional metadata facet is installed.                                                                     |
| #229 tips              | #230 plus receipt/recovery corrections; #324 room-policy preparation                                                                                                                     | Client inclusion does not deploy signaling's authority endpoint or upgrade a contribution facet. Keep real quote/receipt/chat and owner-approved policy/activation acceptance open. Missing local manifest entry and backlog label corrected.                    |
| #85 Product epic       | Current SDK 0.39/TrUAPI 0.25 pairing and 0.1.60 publication                                                                                                                              | Physical Desktop/mobile same-account signing/media/location and shared network-profile acceptance. Mobile version labels are not wire evidence.                                                                                                                  |
| #88 first sound        | Current authenticated v3 AAC is the only supported format                                                                                                                                | Schema-6 candidate-bound cold/warm measurements, adverse transport/key conditions and p75 across supported surfaces. No old DAV2 ranges/workers or schema-5 exports.                                                                                             |
| #87 covers             | Responsive variants and bounded recovery delivered                                                                                                                                       | New-publication/mobile transfer/paint/gateway/cache evidence. No backfill of the retired internal catalog.                                                                                                                                                       |
| #158 W13               | Release tooling, multiple verified publications and 0.1.58 server reset                                                                                                                  | One coherent candidate, native payment/access/room/audio/location evidence, compatible rollback preserving latest custody, and owner-consented pilot up to 42 people. Historical 0.1.25/0.1.26 targets cannot validate the reset.                                |
| #90 wallet later       | Core shared-link journey already delivered                                                                                                                                               | Pilot-backed rescope or observed-friction closure; no replay of broad September UX work.                                                                                                                                                                         |

Product **0.1.60** is published independently of this docs branch; its exact
CID/build/readback and remaining device gates are in
[#327](https://github.com/knzeng-e/dotify/pull/327). That PR is still the
traceability source until merged. This audit does not imply API/signaling/Web
were redeployed with that Product-only publication.

## Future scopes retained

#12 personhood, #13 ambassadors, #181 French, #214 measured Celerity equivalence,
#275 artist modules/inventory, #276 artist key portability, and #289–#294
(access preparation, continuity, shared API state, catalog scale, contract bounds,
horizontal rooms/SFU) have no merged evidence completing their remaining scope.
They stay open. Existing partial Celerity observation is not transport equivalence.
The #13 title/priority label is aligned with its existing P3/Later manifest and
Project value; no roadmap priority is changed.

## Why the backlog drifted

PRs generally target `dev`, while GitHub's default branch is `main`: a closing
keyword on a dev-targeted PR does not perform the final issue closure. Several
merge handoffs left issue state/Project fields unchanged. Other descriptions
mixed completed implementation with separate physical release acceptance, or
kept dated pre-reset/provisioning assumptions as current instructions.

The checker validates mapped items, so #229/#240 could be omitted from the
manifest without that inventory omission being detected. This audit checks the
full open-issue inventory as well; it does not add automatic closure logic.
At each merge handoff, reconcile scope and retained gates, update the issue and
its Project fields, convert a completed manifest entry to a record, and run the
live check. A merged PR alone must not close an explicitly retained acceptance gate.

## Synchronization and validation

Update issue bodies and state, assignees where missing, Project 5 status/type/phase,
and the local manifest together. Preserve old dated evidence with a current
amendment rather than inventing results. The public page must no longer say the
non-root cutover and streaming jobs/player await deployment.

Issue bodies/states were reconciled for the six delivered records and active
acceptance gates; ten missing assignees were filled. All 31 initially open issues
now map to a local backlog entry (the missing #229/#240 entries were added).
Project status/type/phase follows those delivery boundaries.

Both `node scripts/backlog-sync.mjs --check --offline` and `--check --live`
passed after reconciliation. Modified Markdown/JSON formatting, changed-document
local links, public-page HTML parsing and `git diff --check` passed. HTML text
edits preserve the surrounding page formatting; no app runtime changed.
No application tests are needed for this documentation/metadata-only change.
No deployment, secret read/rotation, real-position collection, funded transaction,
artist policy change, permission change or participant contact occurs here.
