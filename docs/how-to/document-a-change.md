# Document a change

Use this guide when changing Dotify behavior, configuration, a security boundary
or a delivery status. The reader should be able to understand the change and
act safely without the author's chat history. Keep the repository's English
documentation consistent; explain a specialist term when it first matters.

## 1. Choose the reader and the job

State who the document helps and what that person needs to achieve. Choose its
main purpose before writing:

| Type        | Reader's goal                            | Appropriate content                                            |
| ----------- | ---------------------------------------- | -------------------------------------------------------------- |
| Tutorial    | Learn through a successful exercise      | Guided steps with a safe, reproducible outcome                 |
| How-to      | Complete a specific task                 | Prerequisites, procedure, expected result and failure handling |
| Reference   | Look up an exact fact                    | Interfaces, units, limits, errors and configuration ownership  |
| Explanation | Understand why the system works this way | Concepts, authority, tradeoffs and honest limitations          |

A dated evidence record answers a separate question: what was actually observed
for a particular artifact and environment? Link it from the relevant guide;
do not make readers reconstruct a procedure from a timeline.

## 2. Give each rule one authoritative home

Put protocol limits and error codes in a reference. Put operational steps in a
how-to or component runbook. Put rationale and trust boundaries in an
explanation or ADR. Keep backlog scope and acceptance criteria in the ticket;
Project 5 owns workflow status.

Link from summaries instead of copying long tables or paragraphs into the
backlog, memories, PR and runbook. A short dated summary can help orientation,
but it must identify the canonical detail and must not introduce another version
of the rule. Source code and tests remain the implementation contract; a
reference must point to their defining module when useful.

## 3. Separate facts that have different lifetimes

Write **candidate settings** for values read from a tracked file, **deployed**
only with artifact/readback evidence, and **accepted** only for the named tested
journey. Record date, commit or image/CID, environment, outcome and remaining
limits. Do not use an undated “current”, “latest”, “final” or “production ready”
when it hides those distinctions.

When a merge changes a test count, preserve the earlier observation and add the
new commit and result. When a new rollout supersedes an old one, update the
short checkpoint and link to both records as needed. Retain old receipts and
history; never treat old approval as permission for a new operation.

## 4. Make the first reading short and useful

Lead with the result or task. Use ordinary words, short paragraphs and one
clear reading path. Put exact comparable values in tables, with units and scope
(per socket, per request, per Room, bytes or code units). Keep essential failure
and security conditions visible. Link detailed logs, measurements and history
instead of appending them to an operating procedure.

For Dotify, connect technical rules to people: an artist controls access; a guest
can join without a wallet; disconnect cancels pending key delivery. Distinguish
those guarantees from limits such as recording, keys already learned by a
client, untested physical Hosts or unknown transaction outcomes. Avoid both
absolute security claims and repeated administrative warnings.

## 5. Change the documentation with the implementation

Use this map to find the affected documents:

| Change                                            | Documentation to check                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| User-visible behavior                             | Relevant user guide and product explanation                              |
| Protocol, request body or error                   | Reference, callers and threat model                                      |
| Configuration, secret ownership or state recovery | Environment reference, tracked examples and deployment/component runbook |
| Product direction or architecture narrative       | Selected backlog sequence, memories and `docs/index.html` as applicable  |
| Test, deployment or device result                 | Dated evidence, bound to the tested artifact                             |

When moving content, preserve its relative links and referenced section anchors.
Keep historical links directed to the archive. For a published old path, provide
a visible route to its new home rather than silently removing the information.

## 6. Review before requesting review

- Can the intended reader find the answer from [the documentation index](../README.md)?
- Is this document mainly one type, with other detail linked where needed?
- Do examples, errors, limits and diagrams agree with the code and each other?
- Are settings distinguished from deployed values, and automation from device acceptance?
- Are results bound to a commit, with failed/pending/skipped checks described truthfully?
- Do local links and moved anchors resolve? Are archived facts labeled as historical?
- Does the PR explain what changed, how it was checked and what remains uncertain?

Follow [the PR writing guide](../explanation/pull-requests-as-knowledge-sharing.md)
for the review narrative. A documentation-only change needs relevant link,
format and factual checks; it does not need an unrelated application test suite.
