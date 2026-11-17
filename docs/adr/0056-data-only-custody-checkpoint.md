# ADR 0056: Capture settled custody as data, never as a runnable writer

- Status: implementation candidate for #407; generated-state validation only
- Extended by: [ADR 0057, isolated reconstruction](0057-isolated-checkpoint-reconstruction.md)
- Related: [admitted recovery](0055-admitted-audio-recovery.md),
  [generated restore rehearsal](../operations/bulletin-generated-restore-rehearsal.md)

## Problem and decision

Generated recovery and compiled-version tests demonstrate format compatibility,
but they cannot preserve a real custody volume. A generic recursive archive risks
copying keys, omitting empty directories or capturing a writer between its intent
and receipt. Restoring an old runnable queue can also replay stale account state.

Add an explicit maintenance CLI with inspect, exact-plan copy and offline verify.
It captures only the active **settled multi-release** domain. The source profile,
queue and publisher are bound together; admission archives, counters, receipts,
nonce reservations, recovery journals and retained encrypted objects keep their
exact bytes. The existing lifetime publisher lease excludes a cooperative writer.
No route, scheduler, transfer, initializer, secret reader or restore is added.

## Data flow and authority

Inspection allowlists private file names, rejects links/open permissions and
unknown files, and validates local settled state. The plan binds raw file hashes,
empty directories, profile identity and required key versions. The permanent
audio inventory supplies the output generation after normal ciphertext/index
pruning; its nonce reservation remains mandatory independently of temporary
files. Public-asset generation labels are not encryption nonces. Copy repeats
inspection against that exact digest, creates a new private destination, streams
files to content-addressed objects, rechecks sources and verifies copied bytes.
A durable manifest is committed last, after which `INCOMPLETE` is removed.
Any failure preserves source state and the incomplete output.

The artifact deliberately contains **logical paths plus hashed objects**, rather
than `jobs.json`/`owner.json` in an executable directory layout. Old services
cannot accidentally consume it. Offline verify checks a separately retained
manifest digest before parsing and checks object hashes against its plan.
It does not open the original source paths stored in the manifest.

Local state is authoritative only for capture, not for spending or restoration.
The copied profile includes a signer path and key commitments, but the configured
signer and key-vault files are not read. Private metadata remains confidential;
`secretsIncluded: false` describes this exclusion, not a general redaction system.
No guarantee is made against a malicious same-UID process or compromised host.

## Alternatives and limits

A Fly volume snapshot remains useful, but alone does not demonstrate independent
data/key recovery or give an exact application-level inventory. A generic tar
copy has no domain completeness or lease checks. A universal importer would add
relocation, key and account-freshness decisions beyond this development slice;
it is intentionally absent.

Unknown files and legacy pilot ledgers refuse rather than disappear from a
successful report. Ready jobs whose ciphertext was normally pruned still retain
their references/history; this command cannot reconstruct that media. Bounds
and operator steps have one home in the [runbook](../operations/bulletin-custody-checkpoint.md).

Tests exercise standard/compact capture, source loss, unchanged histories, missing
reservations, uncertain work, altered digests/objects, links, private permissions,
stale plans, interrupted artifacts and environment-free CLI operation. They use
generated fixtures only. Independent storage, usable secret recovery, canonical
history and actual service/image rollback remain separately reviewed operational
gates; an old idle backup can miss a later broadcast even when its hash is valid.
