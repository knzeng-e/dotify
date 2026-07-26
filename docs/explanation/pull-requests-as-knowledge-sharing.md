# Pull requests as knowledge sharing

## Purpose

A Dotify pull request is both a change proposal and a compact engineering
lesson. It should let a reviewer understand the problem, reconstruct the
reasoning, inspect the implementation in a deliberate order, and maintain the
result without depending on undocumented author context.

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

Every PR description must contain the following information.

### Outcome

Open with the behavior or capability the PR delivers. A reviewer should know
the result before reading implementation detail.

### Issue and context

Explain the original behavior, its user or system impact, why the work matters
now, and the constraints inherited from Dotify's product and security model.
Link the backlog issue and its local scope document.

### Architecture and concepts

Describe the important boundaries, components, ownership, and data or control
flow. Define concepts that may be unfamiliar, such as a read model,
stale-while-revalidate, reorg checkpoint, capability token, or host-only key
delivery. Use the smallest useful diagram when several components interact.

### Design decisions and tradeoffs

Explain why the chosen design fits the ticket. Name meaningful alternatives
that were considered and why they were deferred or rejected. Record deliberate
limitations instead of presenting them as accidental omissions.

### Security, failure, and operations

State what is trusted, what is authoritative, where behavior fails closed,
which degraded modes remain available, what is persisted, and what operators
must configure or monitor. Never imply guarantees the implementation cannot
provide.

### Code map and review guide

Give reviewers an ordered path through the change. For each stage, explain what
they should learn and which invariants or risks they should verify. Point to
specific files, modules, endpoints, contracts, or migrations.

The guide must include concrete review prompts. "Please review" is not enough.
Examples:

- Can a failed write advance the durable checkpoint?
- Does production ever fall back to an insecure demo path?
- Can two representations of the same identity diverge?
- Are cache keys and ETags scoped to every response variant?
- Does a retry duplicate a financial or irreversible action?

### Validation and residual risk

Map tests and checks to the behaviors they prove. Separate automated evidence
from manual or production evidence. List known limitations, follow-up work, and
the condition that allows the linked issue to close.

## Metadata contract

Every applicable metadata field is part of the engineering record, not
administrative decoration.

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
