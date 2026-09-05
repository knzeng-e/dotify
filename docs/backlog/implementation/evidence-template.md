# Wxx — evidence and handoff

Copy this template to `evidence/Wxx.md` when executing a sequence. Do not mark
items passed without observed evidence. Project 5 remains the workflow board.

## Identity

- Sequence and scope:
- Date:
- Starting dev SHA:
- Implementation SHA actually tested:
- Branch / PR / issue:
- Related dependency evidence:
- Code readiness: not started / implemented / locally verified / CI verified
- Release readiness: not deployed / deployed-unverified / live-verified / blocked

## Result and decisions

Explain the user-visible outcome, important design decisions, alternatives,
and the current authority/state boundaries. Name changes from the prompt and
why current evidence justified them. Record already-delivered scope that was
verified without reimplementation.

## Verification

| Command or real scenario | Environment and build | Observed result | Artifact |
| --- | --- | --- | --- |
| Not run yet | — | No evidence | — |

Include sample counts, failures, timings, warning output, and baseline issues.
Separate mocks/local fixtures from real wallets, actual audio, and Product host
results. Redact secrets and private participant data from every artifact.

## Compatibility and operations

- Supported devices, browsers, and Product host versions:
- New config/permissions and documented defaults:
- Storage/key/contract migration and compatibility evidence:
- Deployment identifiers (only if deployed):
- Rollback procedure and rehearsal evidence:
- Data collected, retention, and user controls:

## Acceptance mapping

| Sequence criterion | Passed / failed / not run | Supporting evidence or exact blocker |
| --- | --- | --- |
| Copy each relevant criterion | Not run | — |

## Remaining gates

List unresolved defects, unavailable host/device capabilities, unrun checks,
and any final action requiring authorization not already provided. Distinguish
a research conclusion from delivered functionality. Name issue links for
follow-up work without automatically expanding this sequence.

## Next agent

- Next eligible sequence(s), based on merged prerequisites:
- Files/interfaces changed that the next agent must inspect:
- Decisions that must not be silently reversed:
- Exact command/scenario to reproduce a remaining issue:
- Project/metadata updates completed and any inaccessible fields:
