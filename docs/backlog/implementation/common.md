# Common agent execution contract

This file applies when executing a sequence in this directory. Read the selected
sequence in full. The project-specific rules in `AGENTS.md` and the user's
current authorization still apply. This playbook does not authorize unrelated
changes, deployments, fund transfers, messages, or repository administration.

## Begin with the current repository

1. Read `AGENTS.md`, `docs/backlog/README.md`, the matching ticket,
   `docs/context/dotify-product-memory.md`,
   `docs/context/dotify-technical-memory.md`, and
   `docs/context/dotify-philosophical-north-star.md`. For UI/product work read
   `spec.md`, `README.md`, `docs/index.html`, and the showcase presentation.
2. Inspect `git status`, the current branch, remotes, and relevant open/merged
   PRs. Fetch `origin/dev`. Preserve unrelated local changes; use an isolated
   worktree when needed. Never reset or force-push another person's work.
3. Verify dependencies using merged code and evidence files. Branch existence
   is not completion. If a dependency is absent, do the independent inspection
   or feasibility work, but do not quietly implement the missing sequence.
4. Create the named branch from the latest tested `origin/dev`. If it already
   exists, inspect its ownership, base, commits, and PR before resuming; do not
   overwrite it. If dev is red, identify the failing gate and avoid treating
   the branch as a release candidate. A fix to that gate belongs in a scoped PR.
5. Record the base SHA and a short implementation plan. Compare reviewed
   findings with current code: the assessment snapshot is not timeless truth.
   If an outcome is already implemented, verify it and record evidence rather
   than rewriting it.

The expected loop is **fresh dev → one implementation branch → reviewed PR →
dev → fresh next branch**. Do not stack all future branches on the initial
documentation branch. If two implementers work independently, use separate
worktrees and agree on shared interfaces. These prompts do not require or
automatically authorize spawning additional agents.

## Implement through a reviewable result

Complete the selected scope rather than stopping with recommendations. Keep
changes small enough to review; split a risky migration into explicitly linked
PR slices when needed. Do not expand `App.tsx` with unrelated business logic or
replace working architecture merely to match an old plan.

Product DevNet and ordinary web are both explicit delivery targets. Use the
existing host/runtime adapters. Inspect installed versions and current official
documentation before relying on changing SDK APIs. Keep dependency upgrades
separate unless the selected change requires them. Never claim Product Mobile
supports a browser feature simply because Safari or Chrome does.

Preserve these invariants:

- Room guests join without wallet, signature, payment, or personhood gates.
- Only an authorized host obtains protected content keys; guests receive the
  ephemeral media stream. Playback can still be recorded by recipients.
- No frontend production secrets, demo fallback signers, or silent access bypass.
- Payment submission, finality, entitlement verification, and recipient receipt
  are distinct facts. Retries cannot charge twice.
- Artist/runtime/NFT ownership and beneficiary rights are described accurately.
- Real data drives presence. Session counts are not verified unique humans.
- Audio survives visual navigation, graphics failure, and degraded discovery.
- Location is an opt-in later feature with explicit disclosure limits.

For contract/storage/key changes, include compatibility fixtures and a local
migration/restore rehearsal. Existing purchases, ciphertext, and Diamond storage
cannot be discarded to simplify a patch. A compromised or previously disclosed
key cannot be revoked merely by changing the client interface.

## Verification menu

Inspect the current package scripts before use. At the reviewed baseline the
following commands exist. Use the repository's Node 22 / npm >=10 baseline and
`npm ci` in each affected package. Installation may run package lifecycle hooks;
inspect them if unfamiliar. Do not alter lockfiles incidentally.

| Changed boundary | Commands from repository root |
| --- | --- |
| Frontend | `npm --prefix web run test:unit`; `npm --prefix web run build`; `npm --prefix web run lint` |
| Signaling | `npm --prefix web run test:signal` |
| API | `npm --prefix services/api test`; `npm --prefix services/api run typecheck` |
| Contracts | `npm --prefix contracts/evm test`; inspect/run the existing ABI generation/check workflow |
| Core browser journeys | `npm --prefix web run test:e2e` after inspecting Playwright service/config requirements |
| Backlog documentation | `node scripts/backlog-sync.mjs --check --offline`; `git diff --check` |
| Product package | `npm --prefix web run build:product-devnet` after checking bootstrap/network behavior |

The Product build refreshes its catalog bootstrap and can change generated files;
inspect resulting diffs. Do not commit unexplained generated snapshots. Live
smoke commands may contact configured services; inspect endpoints first and
never expose credentials in logs. A build command is not permission to run a
similarly named deployment command.

Select tests by actual changed risks. Add meaningful regression coverage for
identity, money, keys, state, transport, or privacy changes. Do not add tests
that merely mirror prose or implementation details. Documentation-only work
needs link/manifest/diff checks, not the entire application suite. Record
baseline failures separately; do not suppress them to get a green label.

For real-device evidence, record build SHA, date, browser/OS/device, Product host
version, network profile, attempts, failures, and observed metrics. Mocked
wallets, local contract tests, and synthetic audio are useful but cannot prove
live host signing, final settlement, background playback, or audible startup.
If the environment cannot perform a check, label it **not run** and provide
reproducible steps. Never fill a manual checklist from inference.

## Documentation and issue continuity

Update behavioral/reference docs with the implementation. Changes to config,
origins, secrets handling, mounts, scaling, or hosted settings require checking
`docs/operations/deployment-configuration.md`. Product deployment changes also
require its dedicated runbook. Product positioning, roadmap, visual identity,
and architecture narrative changes must update `docs/index.html` in the same PR.

Use existing backlog issues when the scope matches. Create a dedicated issue
only when activation reveals genuinely new work; keep its Markdown source and
`docs/backlog/backlog.json` mapping consistent. Project 5 owns workflow status.
Do not invent Done statuses or close an epic because a subtask is delivered.
Sequence dependencies live in `sequence.json`; update its matching README table
and prompt metadata if dependencies change.

Write `docs/backlog/implementation/evidence/Wxx.md` using the evidence template.
Evidence paths and result states are durable handoff information, not a second
sprint board. Preserve older evidence when adding a fresh dated run. Cite the
actual tested implementation SHA; avoid the impossible requirement that a
commit record its own hash. Record the tested parent SHA in a later docs commit
or attach final-SHA evidence to the PR.

## Finish with a pull request and precise remaining gates

Follow `.github/pull_request_template.md` and
`docs/explanation/pull-requests-as-knowledge-sharing.md`. Target `dev` with a
draft PR, explain the problem, decisions, data/control flow, risks, review order,
and test results. Link the issue with `Refs` for partial work. Use a closing
keyword only if the whole ticket is complete; GitHub's automatic closure may
depend on the repository's default branch, so check the outcome after merge.

Set the responsible assignee, existing labels, and applicable milestone; add
the PR to Project 5 and mirror Priority, Track, Phase, Type, and Backlog doc.
Request reviewers only where ownership and communication authorization are
known. If a tool lacks metadata access, finish the branch and draft PR, leave
the relevant checklist item unchecked, and state exactly what could not be
updated. Do not claim Project synchronization happened.

Do not merge, deploy, rotate production secrets, modify live contracts, spend
funds, contact pilot users, or change access controls unless that action is
authorized in the current session. If authorization is absent, finish tests,
diffs, runbooks, and rollback plans first; then identify the concrete final
action that remains. Do not ask permission again when it already exists.

Conclude with changed behavior, verification, limitations, branch/PR/evidence
links, and the next eligible sequence. Stop after this sequence.
