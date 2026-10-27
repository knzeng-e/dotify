# Activate shared API state (W36)

This is a **planned migration**, not a record of deployed infrastructure.
Implementation alone does not activate scaling. Local evidence is in
[W36](../backlog/implementation/evidence/W36.md), design in
[ADR 0035](../adr/0035-shared-api-trust-state.md).

## Topology and configuration

`services/api/fly.toml` is the public `edge` profile, with a two-machine ceiling
and no state volume. `fly.custody.toml` is the private single `custody` profile;
it owns `/data/contributions`, the encrypted job queue/permanent nonce ledger,
verified receipts and encoder connection. It has no public HTTP service or
public IP. Provision it without public IPs and keep exactly one machine.
Do not deploy either profile until the import and volume transfer are verified.
A database lock also prevents a second custody writer from starting.

| Variable                        | Where                    | Contract                                                                                                          |
| ------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `STATE_STORE=postgres`          | Both                     | No local fallback; schema/namespace must exist. Default `local` is explicitly single-node development.            |
| `DATABASE_URL`                  | Server secret, both      | Same database; PostgreSQL URL; verified TLS for public transports, private network otherwise. Never `VITE_*`.     |
| `STATE_NAMESPACE=dotify`        | Both                     | Same stable 3-64 character identifier. Distinct namespace/database per environment.                               |
| `SESSION_EPOCH`                 | Server secret, both      | Preserve the existing stable value and imported revocations. Rotation intentionally signs out everyone.           |
| `SESSION_SECRET`                | Server secret, both      | New independent 32 random bytes in hex. Do not change content-key secrets. Required also for local session auth.  |
| `SESSION_PREVIOUS_SECRET`       | Server secret, temporary | Explicit previous signing input for staged rotation/import. No automatic content-master fallback.                 |
| `SESSION_PREVIOUS_SECRET_UNTIL` | Both, temporary          | Absolute UTC deadline, at most 24h ahead when a process starts. Both previous fields must be set together.        |
| `API_ROLE`                      | Both                     | `edge` or `custody` in shared mode. `combined` is only for single-node local mode.                                |
| `CUSTODY_SERVICE_URL`           | Edge                     | Private origin, e.g. `http://dotify-custody.internal:8790`; loopback only in local tests. No path/query/userinfo. |
| `CUSTODY_SERVICE_TOKEN`         | Server secret, both      | Dedicated 32-256 character transport token; never reuse the encoder/native-receipt/session secrets.               |
| Content-key version secrets     | Both                     | Preserve exact values/versions. Edge derives keys after chain access; custody encrypts publications.              |
| `STREAMING_WORKER_URL/TOKEN`    | Custody only             | Existing isolated encoder. An edge rejects these settings.                                                        |
| `PINATA_JWT`                    | Custody only             | Existing upload authority. Never put it in the edge/browser bundle.                                               |
| `NATIVE_RECEIPT_SERVICE_TOKEN`  | Custody                  | Preserve the signaling verifier's existing token; private forwarding does not replace receipt verification.       |
| Existing upload limits          | Custody                  | Same byte/window/concurrency values on every custody deployment. Database accounting survives replacement.        |

Fly's private `.internal` service network uses IPv6. The API listener binds
`::` with `ipv6Only: false`, accepting private IPv6 and public IPv4 ingress on
the same port. A localhost IPv4 health check alone cannot verify custody
reachability: check an actual edge-to-custody request too. The real HTTP
`httpListener.test.ts` exercises both loopback address families.

Reserve at most six DB connections per edge/custody process, plus operator headroom.
Pool acquisition is bounded at 3s, SQL at 3s, lock waits at 1s and client queries
at 4s. A broken transaction connection is discarded. The custody-owner lock
has a 1s heartbeat; failure closes admission and aborts the encoder. Keep the
private network and database near each other. HTTP client limits outside the
custody subtrees remain per public API process; the shared nonce cap and upload
budgets are global. This is not a global distributed general-purpose limiter.

## Initial migration, offline

Obtain authorization for the deployment and any new paid database/service
first. Record exact source/image SHA, DB provider/region/backup policy, volumes,
app names, old/new machine IDs and tested Web/Product profile. This PR creates
none of them.

1. Back up the existing API volume using the W30 custody procedure. Check the
   encrypted sources/jobs, **permanent nonce reservations**, native receipt
   ledger, catalog and session revocations. Keep all content-key secrets in
   their existing secure custody; never include their values in evidence.
2. Stop new uploads and let admitted uploads finish. The old API's quotas are
   in memory and cannot be imported. Keep publication closed for one complete
   `UPLOAD_QUOTA_WINDOW_SECONDS` after the last upload; let outstanding
   capabilities expire. Only then can an empty shared upload budget be valid.
   Preserve the stable epoch and serve no old-instance auth/logout writes
   after the final revocation-file export. Any requested old nonce simply
   needs a fresh challenge after migration; unknown nonces fail closed.
3. Quiesce **all** old API writers, export the final catalog/revocation JSON
   and make a consistent final volume backup. Import requires both files.
   If no revocation file was ever written, explicitly verify that fact before
   preparing an empty `{epoch,revoked:[]}` import; missing/unreadable storage
   is not evidence that nobody signed out.
4. Provision PostgreSQL with backups and an operator migration role. Set the
   new server configuration locally without printing it. Run from `services/api`:

   ```sh
   npm run state:initialize -- --import-quiesced --revocations /secure/export/session-revocations.json --catalog /secure/export/catalog.json
   ```

   The command applies `migrations/001-shared-state.sql` transactionally and
   creates a **new namespace only**. It validates epoch, chain and directory;
   reinitialization refuses to overwrite state. `--fresh` is exclusively for a
   genuinely new empty deployment, never a recovery shortcut. In the built
   image, use `node dist/scripts/initializeSharedState.js` with the same flags.

5. Grant the application role SELECT on `dotify_state_identity` and
   SELECT/INSERT/UPDATE/DELETE on the nonce, revocation and document tables.
   Keep DDL/schema administration with the operator. No sequence privileges
   are needed. Fly MPG protects its built-in roles against custom grants. For
   that provider, the explicitly approved alternative is its managed `writer`
   role plus `migrations/002-managed-runtime-policies.sql`, applied in one
   operator transaction **before** enabling the role. It grants runtime SELECT
   only on the deployment identity and scopes all other state operations to
   `dotify`; the role cannot own/alter/truncate these tables or bypass row
   policies. The script checks these prerequisites and does not run at API
   startup. Adapt the role/namespace explicitly for another deployment. Verify
   these boundaries with a real runtime connection in an isolated database,
   then verify backup/restore before enabling traffic.
6. Transfer the entire quiesced owned volume to the new custody service's volume
   using a verified offline backup/restore. Fly volumes belong to their app;
   reusing the same volume **name** in a new app does not transfer the data.
   Check ownership UID/GID 1000, hashes and the W30 read/write preflight before
   starting custody. Do not call `streaming:initialize` on restored state.
   Retain the original backup offline; never run both copies as writers.
7. To preserve existing sessions, supply the previous content-master signing
   input **explicitly** as `SESSION_PREVIOUS_SECRET`, with an absolute overlap
   deadline within 24h. New signing always uses the independent secret. The
   old epoch and every still-live revocation must match the imported state.
8. Start one private custody process, then one public edge. Verify health,
   identity, logout, key delivery, cover upload, encrypted job status/publication
   and verified receipt history through the public URL. A direct unauthenticated
   custody request must be rejected. Preserve request IDs, not tokens.
9. Start the second public edge, then replace one edge during an active session.
   Submit the **same signed nonce** concurrently to both: exactly one 200.
   Logout on one must cause both to reject the credential and renewed siblings.
   Check combined upload reservations cannot exceed existing limits.
10. Exercise a database outage and custody outage separately. Keys/uploads must
    fail closed with understandable 503s; no wallet-prompt cascade or automatic
    upload replay. Liveness may stay 200; readiness must fail when DB is absent.
    Public cached catalog data can remain visible with outage metadata.
11. Publish matching Web/Product clients for silent renewal. After its authentication deadline, retain the previous secret for delayed
    logout until every family it signed has reached its original 24h deadline;
    it is then removed with the deadline field. Record regional latency,
    DB connection usage, backup age and actual physical Host observations.

## Session-secret rotation without sign-out

Use the same `SESSION_EPOCH`, database and content-key configuration throughout.
For normal rotation old/new secrets are independent session secrets:

1. Roll every process with signing secret A, previous secret B and an explicit
   short deadline. All processes can now verify both, while still signing A.
2. Roll signing secret to B, previous to A, keeping both sides within the overlap
   deadline. Tokens/capabilities issued by either generation remain verifiable.
3. Authentication overlap ends at the configured deadline (at least 2h after
   the last A token for normal rotation; 24h for legacy-session migration).
   Retain the previous secret and its **expired deadline** until the last
   A-signed family reaches its original 24h deadline: it then verifies delayed
   logout only, never authentication/renewal/upload capabilities. Remove both
   fields after that retention window. Do not start another rotation before
   retiring this previous secret. Never extend authentication overlap indefinitely.

Do not rotate a signing key while peers still accept only the other key. Old
and renewed credentials keep the same family ID, so an old credential can
revoke its still-live family after its own 2h playback expiry. Renewal requires
an unexpired credential and stops before the absolute 24h sign-in boundary.
The connected-wallet flow renews on use within the final 15 minutes, without a
new signature. An idle client that misses expiry must sign in again; anonymous
visitors and speculative queue preparation never renew. Only reconnecting the
wallet with a new signature starts another family.
An emergency epoch change must update the namespace identity and every process
configuration together during maintenance. Changing only the environment makes
startup/readiness refuse the mismatched identity. Preserve the database and
revocation history; do not reinitialize the namespace.
For compromised secrets, force sign-out rather than keep the compromised key
in the overlap; import/retain revocations and deliberately rotate the epoch.

## Rollback and restore

For an application rollback, reduce the public API to **one edge** and redeploy
a compatible shared-state image, preserving DB, namespace, epoch, both valid
signing inputs and the single custody volume. A staged secret rollback must
still verify credentials issued by the newer signer. Do not restore the
pre-W36 local-state binary after shared mode has acknowledged writes.

Back up the whole database (e.g. `pg_dump --format=custom`) and perform an
isolated restore with matching client/server versions. Local W36 tests restore
used nonces, revoked families and the catalog into a second database. A stale
backup that omits later acknowledged revocations/nonces/usage is **not** safe
with the old epoch. Replay the missing writes from an authoritative log or
rotate the epoch in both namespace identity and process configuration **and
purge all wallet challenges in `dotify_state_nonces` for that namespace in the
same offline transaction**. Wallet-signature messages do not contain a session
epoch, so epoch rotation alone cannot invalidate a stale restored challenge.
Hold uploads closed until quota reconciliation/expiry. This purge never touches
the separate permanent streaming encryption nonce ledger, which must be preserved.
Preserve the custody volume and every permanent encryption nonce reservation
independently; DB restore does not restore those files or content-key secrets.

## Reproduce the local checks

Use a disposable PostgreSQL database on loopback named `dotify_w36_test`.
The suite changes its schema to simulate an outage and creates/drops a separate
restore database. Use an isolated test/operator role with those permissions;
never point it at a shared or deployed database.

```sh
cd services/api
TEST_DATABASE_URL=postgresql://test-role@127.0.0.1:5432/dotify_w36_test npm run test:shared-state
npm run typecheck
npm test
npm run build
```

The suite starts independent HTTP API processes, signs synthetic EIP-191
challenges, replaces a process, restores a real PostgreSQL dump and checks
atomic replay rejection, quota continuity, family logout, election and fail
closed outages. These are local tests, not live Fly or physical Product evidence.

## Stored data and retention

The store holds wallet address/network-bound nonces (5-minute validity), session
family IDs and revocation deadlines (at most the original 24-hour sign-in
window), and address-bound upload reservations/rolling usage (configured quota
window, 1h by default; active lease at most 15min). Nonces and revocations are
pruned on later issue/logout operations respectively, not by a guaranteed
wall-clock deletion job; a quiet deployment can retain expired records until
maintenance. Upload documents prune on access. Public catalog metadata is
retained as a recoverable checkpoint. Operator database backups have a separate
explicit retention policy. No content master, derived audio key, wallet private
key or bearer token is stored in these tables. The private owned volume retains
encrypted jobs, permanent nonce reservations and verified receipt history under
the existing custody runbooks.

Upload accounting is initialized only by the offline namespace migration. A
missing or malformed upload document fails closed rather than starting an empty
budget. The integration suite verifies both failure cases.
