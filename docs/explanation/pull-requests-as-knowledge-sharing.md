# Pull requests as knowledge sharing

## Purpose

A Dotify pull request is both a change proposal and a compact engineering
lesson. It should let a reviewer understand the problem, reconstruct the
reasoning, inspect the implementation in a deliberate order, and maintain the
result without depending on undocumented author context. Its description is a
decision guide, not a second changelog or a narration of the diff.

A changelog answers "what changed?" A strong PR also answers:

- What was wrong or missing, and who felt the impact?
- Why is this the right boundary for the solution?
- How does data, control, trust, or state move through the system?
- Which invariants must remain true?
- What should a reviewer challenge most carefully?
- What did the team learn, and what remains uncertain?

Write for developers and architects at different experience levels. Introduce
specialized concepts in plain language, then connect them to concrete files and
runtime behavior. Do not turn the description into a generic textbook or
repeat the diff line by line.

## The required story

Every PR description must convey the following information, but not through a
separate heading for every item. Use the four sections in the PR template:
Outcome, Design and boundaries, Review focus, and Evidence and remaining gates.
Scale the depth to the risk: a narrow presentation fix should be brief; a
financial or security change must explain its trust and failure boundaries.
Do not add filler such as "no alternatives" or "no risks" to satisfy a shape.

### Outcome

Open with the behavior or capability the PR delivers. A reviewer should know
the result before reading implementation detail.

### Issue and context

Explain the original behavior, its user or system impact, why the work matters
now, and the constraints inherited from Dotify's product and security model.
Link the backlog issue and its local scope document.

### Design and boundaries

Describe the important boundaries, components, ownership, and data or control
flow. Define unfamiliar concepts in plain language. Explain the decisive design
choice and meaningful alternative, if there was one. For changes involving
trust, money, or operations, state what is authoritative, how failure and
persistence work, and what operators must configure, monitor, or roll back.
Never imply guarantees the implementation cannot provide. Link a design note
or use a small diagram only when it clarifies a multi-component change.

### Review focus

Give reviewers an ordered path through the change. Name the one to three
highest-value questions, each tied to a specific file, module, endpoint,
contract, or migration and a concrete invariant or regression risk.

The guide must include concrete review prompts. "Please review" is not enough.
Examples:

- Can a failed write advance the durable checkpoint?
- Does production ever fall back to an insecure demo path?
- Can two representations of the same identity diverge?
- Are cache keys and ETags scoped to every response variant?
- Does a retry duplicate a financial or irreversible action?

### Evidence and remaining gates

Map tests and checks to the behaviors they prove. Separate automated evidence
from manual or production evidence. List unverified behavior, deliberate
limitations, follow-up work, and the condition that allows the linked issue to
close. Do not list every routine command when one sentence conveys the proof.

## Metadata contract

Every applicable metadata field is part of the engineering record, not
administrative decoration. Set and verify these in GitHub; do not paste a
metadata checklist into the reviewer-facing description.

- Add every PR to GitHub Project 5, `Dotify sprints`.
- Link the backlog issue. Use `Closes #N`, `Fixes #N`, or `Resolves #N` when
  merging the PR should complete the ticket.
- For a partial PR, use `Refs #N`, explain the remaining acceptance criteria,
  and keep both the issue and PR associated with Project 5.
- Mirror the issue's Priority, Track, Phase, Type, and Backlog doc fields on the
  PR Project item.
- Set the workflow status truthfully: draft implementation is normally In
  Progress; a PR actively awaiting human review is In Review.
- Add the responsible assignee and the narrowest useful existing labels.
- Set a milestone when the repository has an applicable active milestone; do
  not invent one only to fill the field.
- Request reviewers when ownership is known. Do not assign arbitrary people or
  request the PR author to review their own change.
- Keep the PR draft until its stated review prerequisites are satisfied.

## Review-ready checklist

Before requesting review:

1. Confirm the branch contains one coherent backlog scope.
2. Re-read the PR description against the final diff.
3. Verify the issue link and closure semantics.
4. Add the PR to Project 5 and mirror the ticket fields.
5. Check assignee, labels, milestone, draft state, and reviewers.
6. Provide an ordered code map and high-risk review prompts.
7. Report commands and outcomes, including warnings.
8. Identify evidence that still requires deployment or manual validation.
9. Confirm docs describe operational and security boundaries honestly.
10. Make sure a reviewer can explain the design without private context.

## Definition of done

A PR is ready for review when a reviewer can answer all of these questions from
the description and diff:

- What problem does this solve?
- Why was this architecture chosen?
- How does the main request or state flow work?
- Where are the security and persistence boundaries?
- Which files should be reviewed first, and why?
- What are the most likely regressions?
- Which tests prove the intended behavior?
- What remains before the issue can close?

If those answers require a private conversation with the author, the PR
description is incomplete.
