# Backlog execution alignment, 2026-11-09

Refs #407, #395 and #388. Audited from merged dev `1e177640` after #418;
its tree is identical to reviewed/tested `551e53b7`. The post-merge dev CI
remains an independent gate before any server rollout.

## Finding

The live structural check passed before reconciliation: the manifest’s 79 items
satisfied the structural rules for mapped issue states, required cards and fields. That success did **not** establish
that descriptions or scheduling reflected the owner's latest execution order.
The check does not interpret prose, rank Now/Next cards or validate issue titles.
PR CI runs the offline check; the live Project check runs on its scheduled/manual
path. No new automation, token or permission is added by this change.

Concrete semantic drift:

- #407's manifest summary still ended at fresh-key setup, despite 0.1.82 delivery
  and the owner's visibility/listening acceptance. #418 was merged but described
  only as a candidate; its server activation and full-publication timing remain open.
- #395 still led with the original silent-guests incident, although reported guest
  sound now works and the next issue is roughly 55-second mobile-host startup.
- #388 summaries still described account/discovery implementation or room-context
  review; those refinements are delivered, while solo/Room system artwork can be late.
- Five older scopes competed with #407 in Now. The undated recommended order and
  October Nearby decision also left a Nearby-first/CASH-deferred reading available.

## Reconciled execution

The [selected plan](../listening-and-publication-readiness.md) is the scheduling
entry point; Project 5 remains the workflow-status authority. No second status
board is introduced in Markdown. The manifest retains all issue mappings.

| Scope | Phase before | Phase after | Remaining responsibility |
| --- | --- | --- | --- |
| #407 publication | Now | Now | Prepare #418 server rollout and a bounded phase measurement; prove acceptable complete publication latency. |
| #395 Room startup | Next | Next | Measure comparable phone-host starts and correct the observed slow phase. |
| #388 system artwork | Next | Next | Diagnose late cover in both modes and verify repeated physical lock/track-change behavior. |
| #406 CASH tips | Next | Next | Shipped-Host feasibility and receipt/policy go/no-go, after reliability. |
| #408 CASH access | Later | Later | Payment-to-access/royalty settlement research, after #406. |
| #317 cutover | Now | Next | Preserve delivered cutover and remaining exact-candidate access/value-flow acceptance. |
| #269 release follow-up | Now | Next | Actual-runtime metadata and contribution receipt/policy acceptance. |
| #229 native contributions | Now | Next | Existing PAS activation/receipt/policy evidence, distinct from CASH research. |
| #274 Nearby | Now | Next | Exact-Host location, lifecycle and two-client discovery-to-audio evidence. |
| #158 pilot | Now | Next | Aggregate release gate, including access, value flows, conservation and recovery. |

The five partially delivered issues remain open/In Progress. Next describes
priority, not untouched code. #288 conservation/access/off-volume recovery and
#85/#87 compatibility/artwork gates are retained; none is closed to simplify the
board. Historical prompts are retained and marked as superseded for scheduling.
The public page and context memories point to the same selected sequence.

## Boundaries and maintenance rule

The immediate next task is preparing the #418 server delivery and measurement
protocol. Merging code is separate from deployment, and a verification-component
benchmark is separate from full-publication latency. Existing receipts, keys,
allowances and retention obligations are unchanged. No service, signing, musical
write, payment, reset or funded pilot is performed by reconciliation.

At each merge or owner acceptance, update the affected manifest summary and issue
checkpoint plus the selected-plan checkpoint when priority or delivery changes.
Check Project metadata with `node scripts/backlog-sync.mjs --check --live` and
read the remaining outcome: a green structural check alone cannot detect stale
prose. Do not close implementation/acceptance scopes merely because a linked PR
merged; apply each issue's explicit completion boundary.

## Validation

Offline manifest, whitespace and 303 local Markdown-link checks pass. The applied GitHub update uses
three issue title/checkpoint refreshes (#407/#395/#388), checkpoint additions to
the five supporting issues, and five Project Phase changes Now → Next. Live
structural validation passes against this manifest after the GitHub updates; the
open issue states and existing workflow statuses are preserved. Merge this
manifest before treating dev’s live drift check as aligned: the Project is
already updated, while the older dev manifest still has five Now phases.
