# PR review quality

## Current reconciliation, 2026-10-23

#241 is merged; the four-section template and writing guide are present.
#240 closes as delivered documentation. No deployment or native-device gate
belongs to this process-only scope.

Issue: #240

## Outcome

Make Dotify PR descriptions easier to review repeatedly without losing the
architectural and operational knowledge they are meant to preserve.

## Scope

- Use four reviewer-facing sections: outcome, design and boundaries, review
  focus, evidence and remaining gates.
- Keep issue linkage, design reasoning, security/failure boundaries, concrete
  review questions, and proof proportional to the change's risk.
- Verify Project 5 and other GitHub metadata outside the narrative body.

## Acceptance

- The template prompts for every required part of the PR knowledge-sharing
  contract without duplicating the same flow across sections.
- A small change can be described briefly; money, access, security, migration,
  or deployment changes still carry their necessary detail.
- No runtime or deployment behavior changes.

Historical PR descriptions and metadata automation are out of scope.
