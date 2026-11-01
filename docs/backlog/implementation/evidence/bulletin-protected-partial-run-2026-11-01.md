# Protected Bulletin canary: two confirmed stores, continuation pending

The owner authorized at most **16 stores / 713,229 bytes** on Bulletin DevNet,
then enabled the local signer. The first signed run stopped after two stores.
Both are now verified against exact sender/nonce receipts and their fetched
ciphertext authenticates with the private local key. The graph is **not ready**;
this is partial storage evidence, not a completed upload or playback acceptance.

Refs #288 / W33 and #287 / W32. This follows the
[immutable package preparation](bulletin-protected-package-2026-11-01.md) and
[ADR 0041](../../../adr/0041-private-bulletin-canary-package.md).

## Artifact and authorized scope

- Account: `5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca`.
- Endpoint: `wss://bulletin-paseo.tservices.es:8443`.
- Genesis: `0xe101f0fa4627d29a257645e02be86d80378fea1a2bf8fa6a918d150ebc760a59`.
- Artifact implementation: `e1ea30f340e10d6204846c865c5a21fb9a420af0`;
  execution checkout `e112ad0e28434f0433f0c04eb56e81fc8b660c1f`, identical code.
  Dev `55cf660417fa8384fa9e9c2c325063f9206736e0` had green CI before execution.
- Approval digest: `c1dbb79cec39fd5e7aaac812de493439c4931aa2d5b28a6a100db73f603cf440`.
- Root: `bafykbzacec2bpys6cfd23kbnvg4p7fidf6laimhd5afshs32sgilt74gkybhw`.
- Job: `stream-09958498-7d0e-41c3-aacf-ff759bf8aa53`.
- Content: generated eight-second chord, encrypted real AAC; no artist audio.
  The content key and custody secret remain private. No renewal, runtime
  registration, key distribution, DotNS update or production activation.

The sole live writer package is in the owner's persistent private Dotify
application-support directory, outside the repository. Its pre-run inspection
snapshot passed checksums. Temporary copies are marked inspection-only. This
same-disk snapshot is not a backup against loss of that disk.

## Live results and recovery

The run started at 00:35:57 UTC and stopped around 00:36:38 on November 1.
Both stores belong to finalized block **1,451,299**, timestamp 00:36:18 UTC:

| Object                |  Bytes | Account nonce | Storage index | Expires at block |
| --------------------- | -----: | ------------: | ------------: | ---------------: |
| `160/init.bin`        |    780 |          1030 |             0 |        1,652,899 |
| `160/segment-000.bin` | 80,208 |          1031 |             1 |        1,652,899 |

The independent read-only audit at 00:44:58 verified the direct calls, successful
storage events, account/nonces, raw CID hashes and authenticated decryption of
both network-fetched objects. It made no stores or signature requests. Local
validation separately authenticated and decoded all three prepared renditions;
that local decode does not establish full graph availability on Bulletin.

Read-only reconciliation recovered both pending intents. After fixing report
serialization, the actual operator persisted this observation at 00:47:16:

| Durable state                                  | Value                         |
| ---------------------------------------------- | ----------------------------- |
| Attempted stores / bytes                       | 2 / 80,988                    |
| Verified receipts / unresolved pending         | 2 / 0                         |
| Finalized account nonce and durable next nonce | 1032                          |
| Ready                                          | false                         |
| Remaining original allowance                   | **14 stores / 632,241 bytes** |

The active-job barrier stays in place until the identical graph completes. Do
not use this account for other transactions, clear attempts, copy an old owner
cursor over live state or rerun a temporary package. No duplicate stores were
submitted. The signer environment variable was removed after the failed run.

At finalized head 1,451,402, the preflight retained 48 transaction slots after
subtracting the earlier 91-slot reserve, 47,767,052 store bytes and 41,072,542
renewable bytes after the earlier 20-MiB floor. These observations cover the
remaining 14 stores and 16 new renewal slots at that time; they are not reserved
on-chain and must be checked again. No renewal was sent.

## Defects found and repair

**Confirmed reporting defect:** RPC allowance counters are u64 BigInts. The
operator attempted to pass them directly to the journal's JSON writer, which
cannot serialize BigInt. Reconciliation itself had succeeded; writing its
observation then failed. Observation reports now encode BigInts as exact decimal
strings without changing numeric nonce/receipt custody schemas.

**Insufficient finality margin:** a separate read-only observation at 00:46:34
found finalized block 1,451,397 timestamped 00:46:06 and best block 1,451,401
timestamped 00:46:30, a 24-second difference. The old 25-second whole-store bound
included quota checks, inclusion, finality and readback. That bound can expire
during normal finalization. The first run exposed only a generic stage error;
this later measurement does **not** prove its precise original exception.

The repaired layers use 25-second RPC reads, 30-second custody reads,
90-second finality observation and a 120-second whole-store ceiling. Owner
cancellation, the five-minute publication cap and ten-minute operator cap still
take precedence. Longer observation does not authorize resubmission: expired
or cancelled stores retain their durable pending intents. The CLI now prints a
controlled failure category, never raw signer/provider exception text.

**Source provenance:** the package still binds its original implementation.
The original invocation rejects changed publisher code. A new optional
`--source-approval EXACT_REVIEWED_COMMIT` requires separate owner approval of a
descendant repair whose code matches the clean running checkout. It does not
alter the artifact digest, root, custody, nonce cursors or cumulative allowance.
Without that flag the original source binding remains strict. Reports of a
signed run record both the artifact implementation and execution approval.

## Validation and next gates

Clock-controlled tests prove that store finalization can take 40 seconds without
being cut off by a read deadline; a hung read still expires at 25 seconds, an
unfinalized watch at 90 seconds and an unresponsive custody store at 120 seconds.
The latter retains both uncertain nonces and refuses automatic replay. Operator
tests exercise actual partial reconciliation, exact counters above JavaScript's
safe-integer range, dirty/unreviewed source rejection and explicit repair-source
approval. Local checks pass: 273 API tests and TypeScript checking, 33 pipeline
tests, nine private-canary tests and eight protected-access rehearsal checks.
The backlog manifest and changed evidence/runbook links also pass. Node's
mock-timer experimental warning is expected for clock-controlled tests. CI is
recorded on the repair PR separately from these local results.

Before continuation: review the repaired operator, await its green CI, approve
the exact execution revision, recheck nonce/quota and activate the signer only
when requested. Resume the same package within its remaining 14-store allowance;
do not prepare new ciphertext. Then audit all finalized graph objects and local
decryption. Full signed network duration, real runtime access/key delivery,
protected Web/Host listening, representative-release costs and recurring
retention remain separate gates. No production storage route changed.
