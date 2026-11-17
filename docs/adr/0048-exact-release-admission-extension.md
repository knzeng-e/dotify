# 0048 — Extend admission for an exact release without rotating its key domain

Date: 2026-11-10. Status: accepted; first bounded activation recorded in #423. Refs #407, extending ADR 0046.

## Decision and reason

The two original development release identities are claimed. The owner chose a
different source for the next measured publication. Rotating the content master
just to add capacity would multiply keys and require coordinated API installation;
copying/resetting the queue could lose permanent nonce reservations. Keep the
existing profile, content-key domain, queue and inventories in place.

A private, stopped-writer command can append one reviewed **exact** owner/chain/
runtime/source-hash/key-version grant. The artist must already belong to the
profile. Each grant adds one complete original audio + cover + metadata allowance;
it cannot increase any per-part cap or permit another source. The inherited caps
are deliberately conservative; observed graph size is not a spending instruction.
Original unused capacity, original claims and every prior grant remain charged.
The combined original effective capacity and grants are capped at 64 releases.

## One durable commit

The request binds the normalized profile hash and normalized current admission
hash. Normalized means SHA-256 of parsed JSON serialized with `JSON.stringify`,
not the raw file bytes. Pure queue/binding schemas keep the command out of
application configuration and key-vault imports. Inspect returns the proposed additional allowance without
writing. Apply uses the runtime's exclusive publisher lease, checks profile/queue
bindings and refuses active, non-ready, uncertain, orphaned or incomplete state.
It neither removes stale locks nor repairs missing files.

Apply exclusively archives the pre-extension ledger, fsyncs it, then atomically
replaces `release-admission.json` with strict v2 state. Its extension list records
the exact scope, owner and previous checkpoint digest. An archive alone grants
nothing; an interrupted pre-commit attempt can reuse only the same validated
archive. Repeating a committed request fails the changed checkpoint and cannot
add capacity again. Existing profile, signer, content keys, nonce reservations,
account cursor, jobs and receipts are never rewritten by this command.

Runtime reads verify each private archive and its digest, the extension-list
prefix, preserved prior scopes/claims, exact eligible artist and global bound.
Grant scopes do not consume original slots and cannot admit a fourth unrelated
scope when the original two slots and one grant are occupied. A running admission
instance pins its extension list; it refuses a hot change. All normal upload
signatures, canonical artist checks, first metadata binding, per-part budgets,
submission reconciliation and retention checks still apply.

## Trust and operational limits

These files are operator-controlled local authority, not an on-chain quota grant
or a cryptographic approval from the artist. The archives detect incoherent state
and preserve an audit path; they do not defend against a privileged operator
rewriting the entire volume. No automatic refund, expiry, general allowance,
conservation scheduler, network write or signing follows from a code merge.
The inspection is not a fresh chain/quota check or an off-volume backup.

Activation requires reviewed maintenance, a coherent snapshot, current quota and
retention obligations, and separately approved musical write ceilings. The tool
can run only with a compatible custody image. **Old strict builds cannot read v2**;
after activation, rollback must preserve v2 state and use compatible code or keep
publication disabled. Restoring v1 or deleting an archive is not a rollback.

This does not implement the broader cross-host admission database or sustainable
retention model. Full-publication stage timings, actual wallet/catalogue/sound and
public-pilot recovery still remain acceptance gates under #407/#288.
