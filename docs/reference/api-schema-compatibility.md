# API schema compatibility

The #432 candidate uses **Zod 4.6.7** through the normal `zod` entry point.
It replaces the vulnerable 3.25.76 runtime, rather than routing validation through
`zod/v3`. [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
is fixed in 4.6.6 and later. This is a source-level change; it does not identify
the version running on Fly.

## What stays stable

Public handlers retain their HTTP status and `{ error, issues }` validation
responses, with each issue reduced to a path and message. Zod's diagnostic
wording can change; callers must not treat it as a machine-readable error code.
Wallet, release and key-access checks still run independently of validation.
The [request byte and structure limits](request-limits.md) remain in place,
including the separate multipart limits.

Private profiles, inventories, admissions and queues keep their existing schema
versions. The two inventory dictionaries now explicitly declare string keys,
as required by Zod 4; their serialized representation is unchanged. Parsing does
not fill in new defaults or rewrite state. Canonical JSON must retain its exact
SHA-256 digest because those digests bind publication and recovery decisions.
Unknown strict-state fields still fail; startup must never recreate rejected
journals or reset spent allowances and nonce history.

Zod 4 rejects unsafe integers and malformed UUID variants more strictly. Dotify's
queue IDs use `randomUUID()` or the version/variant bits set by `releaseJob()`;
existing generated IDs pass. Unsafe timestamps or malformed IDs are not repaired
or coerced. Investigate a refused live record before any deployment, rather than
loosening the parser to make startup succeed. See the
[upstream migration guide](https://zod.dev/v4/changelog).

## How compatibility is checked

- `services/api/src/services/schemaCompatibility.test.ts` checks 42 historical
  records against canonical hashes captured with the actual Zod 3 schemas at
  `1a6b22d49679a4af4c9156f3229e69c754fcd0be`. Pilot, standard and compact cases cover
  prepared, uncertain and ready states. Each also rejects an unknown top-level
  field. The array regression verifies that an oversized collection is refused
  before visiting its elements.
- The `schema-upgrade` job in `bulletin-backup-restore.yml` prepares generated
  journals with that historical checkout and its own lockfile. The candidate
  then recovers both layouts, authenticates the original audio and refuses six
  inconsistent histories per layout without new stores.
- The [compiled-version rehearsal](../operations/bulletin-generated-restore-rehearsal.md#compare-compiled-historical-versions)
  compares recovery-plan hashes and switches executables against advanced
  journals. It does not rewind them or certify a full service rollback.
- API routes, shared PostgreSQL state, codec and isolated publication/recovery
  suites remain required. These checks complement historical parsing; they are
  not replaced by it.

The committed JSON contains only generated test records, no exported live state
or secret keys. To independently reproduce the capture, create a clean checkout
of the pinned revision and install its API lockfile with `npm ci`. From the
candidate's `services/api`, run:

```sh
node --import tsx scripts/capture-zod3-schema-fixtures.mjs \
  /PRIVATE/zod3-baseline /PRIVATE/generated-zod3-state.json
```

The destination must be absent. The script verifies the historical revision,
clean tracked files and installed Zod version. UUIDs, timestamps and temporary
paths vary between captures; each output carries hashes from the old parser.
Do not regenerate expected hashes with the new parser merely to make a test pass.

## Delivery boundary

No environment variable, key format, admission or allowance changes. Deployment
still needs a reviewed artifact, preserved state and an idle-writer check under
the existing [deployment procedure](../operations/deployment-configuration.md).
Generated tests do not inspect all live journals or authorize maintenance.
