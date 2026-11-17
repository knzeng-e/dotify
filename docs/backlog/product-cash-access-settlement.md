# Product CASH access and royalty settlement

Issue #408 · P2 · Product SDK · Later · Research. Workflow: Project 5.

Dependencies: #406 shipped-Host tip feasibility, #85 compatibility and the existing
runtime/key-service access boundary. Preserve the dated W16 decision and native
PAS behavior. This is a new reassessment, not activation of its old prompt.

## Deliverable and acceptance

Write a dated go/no-go design with a deterministic settlement harness. Bind exact
payer, recipient, network/asset, integer amount, release and final payment to one
runtime entitlement and correct beneficiary/royalty accounting. Decide who bears
reconciliation, refund and dispute responsibility, including payment completed
but entitlement unavailable. Compare supported trust models explicitly; a new
trusted relay requires a separate design decision.

Test wrong identity/asset/chain, reused receipt, duplicate retry, partial/unknown
payment, delayed finality/reorg, crash between payment and access, and failed
reconciliation. A Host Completed callback alone is not a listening entitlement;
the canonical runtime and signed key service remain authoritative.

A supported reviewed mechanism may lead to a disabled-by-default adapter and a
separately authorized funded rehearsal. No fake PAS/CASH conversion, funded
transaction, contract upgrade, deployment or new service follows from planning.
See [execution order](implementation/listening-and-publication-readiness.md).
