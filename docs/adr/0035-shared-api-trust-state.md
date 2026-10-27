# ADR 0035: shared API trust state with one publication custody service

Status: accepted for implementation, activation pending W36 deployment evidence.
Date: 2026-10-27. Refs [#291](https://github.com/knzeng-e/dotify/issues/291).

## Decision

Use PostgreSQL for expiring wallet nonces, session-family revocations, upload
reservations/usage and the public catalog checkpoint. Two public API replicas
read the same deployment namespace. Content-key derivation and authoritative
chain policy checks are unchanged. Neither the browser nor Product receives a
database credential.

A namespace is explicitly initialized with schema version, chain, directory
and stable session epoch. API startup cannot create a missing store. SQL row
locks consume a nonce once; namespace admission bounds the live nonce set at
4096. Upload accounting runs in short transactions around a bounded JSON
state document, preserving the existing byte/concurrency limits. No RPC,
upload or encoder operation holds those transactions open. Active leases
expire after 15 minutes; abandoned leases conservatively charge their full
budget for the quota window. Successful completion charges actual bytes.

Catalog election uses a PostgreSQL session advisory lock. The elected writer
saves through that exact connection, so a disconnected old writer cannot save
through a fresh pool connection after another process takes over. Catalog HTTP
reads refresh the committed checkpoint; public stale data may survive a store
outage with an outage status. It cannot grant key access. Full-snapshot reads
and one indexing writer remain deliberate limits until W37.

Sessions use a dedicated 32-byte `SESSION_SECRET`, independently domain-derived
from upload capabilities and unrelated to content-key masters. Two-hour
credentials renew only while unexpired, within the original 24-hour sign-in
window. Renewal keeps the session family ID. Logout revokes that family until
the absolute window ends, including when an older parent credential has
expired. Renewal and revocation serialize on that family. The client renews
only an identity-scoped session supplied by a connected wallet flow; anonymous
playback/speculation never opens a wallet or renews a session. Rotation has an
explicit previous-secret deadline, at most 24 hours, and a staged rollout so
old and new API instances verify each other's credentials.

## Publication and receipt custody

W36's original audit predates the durable encrypted upload jobs. Scaling their
local volume as if it were shared would lose jobs and split the permanent AES
nonce ledger. Therefore publication, owned job status/actions and verified
native contribution history stay on **one private custody process**, with the
existing owned volume and isolated encoder. Public replicas stream these two
HTTP subtrees to that service. The edge overwrites the private service token
and trusted client identity; the custody service still applies normal session,
artist, capability and receipt verification. There is no automatic POST retry.
The private token grants transport entry, not artist/access/receipt authority.

Shared mode requires an explicit `edge` or `custody` role. An edge cannot start
the encoder. A database custody-owner lock prevents two custody processes from
starting; a failed connection/heartbeat closes admission and aborts encoding.
This is defense in depth, **not permission to copy the volume into active
replicas**. Keep exactly one custody machine and one authoritative volume.
The custody service is still a publication/history availability bottleneck;
ordinary catalog/key API replicas remain independent of it.

## Why PostgreSQL

Transactions, uniqueness, expiry indexes, durable checkpoints and backups fit
these states together. Use a small managed PostgreSQL deployment near the API
(Amsterdam initially), with persistence, verified TLS outside the private
network, backups and explicit credentials. A pool is bounded at six connections
per process; database statements, lock waits, connection acquisition and client
queries have deadlines. A store failure returns an understandable 503 and never
falls back to local trust state. Namespace identity and database errors do not
expose connection strings or tokens.

Redis can implement nonce consumption and quota scripts efficiently, but would
need coordinated Lua/transactions, durable persistence and a catalog/receipt
storage decision anyway. Introducing Redis and a second durable database now
adds operation and restore boundaries. PostgreSQL adds a network round trip and
managed-database cost; it does not make this chain-dependent app decentralized
by itself. No provider, paid plan or new infrastructure is provisioned by this
PR. Capacity, regional latency and provider recovery must be measured at rollout.
A central upload document intentionally favors the existing low-concurrency
pilot over unmeasured sharding.

## Migration and rollback

See [the operator procedure](../operations/shared-api-state.md). Quiesce the old
single-node API, drain its in-memory quota window, import its revocations and
catalog, and preserve every encrypted job, permanent nonce reservation, receipt
and content-key version secret. A missing backup is never permission to start
empty. The previous content master may be supplied explicitly as the temporary
previous session secret to verify old signatures; it is not an automatic
fallback and must be removed after the bounded migration window.

After activation, rollback means one public edge using the **same shared state**
and the same custody volume, or restoration of a complete verified database
backup with appropriate revocation/epoch handling. Returning to the pre-W36
local-state binary can resurrect signed-out sessions or reset budgets and is
not a safe rollback. A backup older than acknowledged security writes cannot
be served with the same epoch without replaying those writes; otherwise rotate
the epoch explicitly, accept sign-out and reconcile quotas before reopening.

## References

- [PostgreSQL advisory and transaction lock semantics](https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS)
- [node-postgres transaction connection requirements](https://node-postgres.com/features/transactions)
- [node-postgres bounded pools](https://node-postgres.com/apis/pool)
- [Fastify proxy streaming and hooks](https://github.com/fastify/fastify-http-proxy)

Upload accounting is initialized only by the offline namespace migration. A
missing or malformed upload document fails closed rather than starting an empty
budget. The integration suite verifies both failure cases.
