# Measure generated Bulletin resource use

Use this contributor procedure before proposing a compact-format rollout. It
measures real AAC encoding, queue encryption, graph construction and authenticated
object reads inside the existing production API/encoder images. It does not
start the API HTTP/custody entrypoint, select a live admission or contact Bulletin.

## Run the isolated exercise

Use Node 22, Git and a local Docker engine with Linux cgroup v2. From a clean
committed checkout, run:

```sh
node services/api/scripts/rehearse-bulletin-resources.mjs > /PRIVATE/resource-report.json
```

The default runs all four cases: generated 97-second and 900-second WAV sources,
each through standard `unixfs-files-v1` and compact `rendition-pack-v1` graphs.
For a focused local investigation only, add `--seconds 97` or `--seconds 900`.
The [CI workflow](../../.github/workflows/bulletin-resource-envelope.yml) always
runs both durations and retains the numeric JSON report for seven days.

No dependency installation on the host is required; the two image builds use
locked API dependencies. The command accepts neither an artist file nor an
endpoint/key argument. It forwards only fixed synthetic worker credentials and
profile values to the containers. Build progress goes to stderr; stdout contains
the JSON result. Run in a trusted shell, without injected Node loaders.

## Resource and data boundaries

| Component | Fixed boundary |
| --- | --- |
| Controller | 1 GiB memory, no swap, one CPU, 64 PIDs, UID 1000 |
| Encoder | 512 MiB memory, no swap, one CPU, 64 PIDs, UID 1000 |
| Writable storage | A new Docker volume for each case; bounded 256-MiB `/tmp` tmpfs per controller/encoder |
| Container protection | Read-only image, dropped capabilities, no new privileges |
| Network | A rehearsal-owned internal Docker network; only the isolated encoder connection |
| Media/key/authority | Generated sine-wave WAV, fixed public fixture key and injected artist authority; no production access verification |
| Publication | In-memory graph construction/readback; zero network stores, signatures or renewal operations |

The driver builds the unchanged Dockerfiles. It never pushes an image or mounts
a host custody directory. A short root helper provisions only each newly created
empty volume; controller and encoder execute as UID 1000. The encoder contains
no API modules, dependency tree or content-key/signing environment. Each case
gets a fresh encoder and controller so cgroup high-water marks cannot carry over
from another profile. Only rehearsal-created containers, volumes, network and
image tags are removed. A failed container removal retains volumes for inspection.

The normal `StreamingJobs` queue handles source encryption, isolated encoding,
authenticated persisted output and the ready reference. The selected constructor
builds the standard or compact graph from that complete ciphertext. The probe
checks block CIDs, authenticates the original encrypted archive input, then reads
and authenticates every rendition object through the matching playback reader.
It reads a cold tail object before each full ordered rendition. The playback
reader continues to reject archive paths; this exercise adds no archive route.

## Interpret the JSON

The report binds the Git revision/dirty flag, runtime image IDs, architecture,
Node and encoder build. The following fields have distinct meanings:

| Field | Meaning and limit |
| --- | --- |
| `elapsedMs` | Queue enqueue/run/stop, including encode/encrypt/build/authentication; excludes image build, source generation and volume setup. Not a network publication time or first sound. |
| `graphMs`, `authenticatedReadMs` | Local constructor time and rendition read/authentication time; neither includes RPC/finality. |
| `phases[].rssBytes` | Process resident memory observed at that checkpoint, not that phase's isolated peak. |
| `processPeakRssKiB` | Linux process high-water mark since process start. It includes fixture generation and retained verification buffers; it never resets between phases. |
| `heapUsedBytes`, `externalBytes`, `arrayBufferBytes` | V8 observations. Array buffers are part of external memory; these are not additive totals. |
| `cgroup.observedPeakBytes` | Container memory high-water mark read near completion; includes charged cache/tmpfs, beyond the Node heap. |
| `cgroup.events` | Kernel memory events. Any `oom` or `oom_kill` makes the case fail; hitting the hard cap is not evidence of comfortable headroom. |
| `graphBlocks`, `graphBytes` | Complete generated graph, including archive, manifest and directory/index blocks. Different layout counts are not live latency. |
| `logicalBlockReadBytes` | Sum of injected block reads, including repeated reads; no HTTP/cache/network throughput is measured. |

The API and encoder caps match the tracked deployment plan; that does **not**
measure available hosted memory or concurrent traffic. A successful run proves
these generated cases completed inside enforced local limits with no OOM. It
does not prove a production capacity/SLA, a memory improvement, arbitrary
uploaded media, simultaneous relay/catalogue traffic or the independent two-SDK
native lookup budget. Single observations on different architectures are not a
controlled speed comparison. Page-cache ownership and garbage collection can
also vary across fresh containers; their peaks are observations, not an isolated
layout-memory comparison. Never raise a service limit or relax an assertion
merely to turn the report green; investigate the failing profile first.

[Source-bound local observations](../backlog/implementation/evidence/bulletin-resource-envelope-2026-11-12.md) record the measured profiles and limits.

## Failure and remaining acceptance

The command exits unsuccessfully on a missing bound, invalid graph/authentication,
failed queue result, OOM, timeout or failed cleanup. A failed report retains only
completed numeric cases and bounded container state (running, exit code, OOM),
not raw errors or audio/key bytes. Build/test stderr remains a local/CI diagnostic.
Reconcile any retained **synthetic** resources by their printed rehearsal prefix;
never use a global Docker prune as cleanup.

[Prepared recovery](bulletin-prepared-job-recovery.md) and
[backup/version compatibility](bulletin-generated-restore-rehearsal.md) remain
separate tests. Real independently stored backups/key restoration, canonical
account history and service/image rollback, hosted peak memory under actual
traffic, physical Host/adaptation/Room/background and audible first sound still
require their own acceptance before compact activation. No service, key, quota,
admission, musical asset, DotNS record or deployment changes here.
