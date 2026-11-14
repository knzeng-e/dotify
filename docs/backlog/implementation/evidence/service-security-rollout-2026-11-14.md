# Server security and runtime delivery — 14 November 2026

## Result and scope

The existing public API pair, private custody writer, isolated encoder and Room
signaling service now run the reviewed server images. Web/Product remain 0.1.84.
Server health, image identity and protected-state checks pass. Physical listening
and Room acceptance after this server update remain pending; the earlier client
acceptance belongs to the preceding server deployment.

The owner authorized these registry uploads, a custody snapshot, filtered private
inspection and maintenance. No Bulletin operation, renewal, DotNS signature or
new musical upload was performed. Keys, admissions, musical budgets and service
settings were preserved. No compact publishing or CASH was activated; the real
second-computer recovery rehearsal remains deferred.

## Artifact identity

Image source: `91f25c77ddb117f97bba4b7808a7ad2fb4b8e244`.
Tested dev: `855ad7a34a2878907550707762359883b1017b15`, with
[successful CI](https://github.com/knzeng-e/dotify/actions/runs/43561372036).
Their difference is documentation only: service sources, Dockerfiles, build
context filters and dependency locks match.

| Role | Immutable registry manifest |
| --- | --- |
| API and custody | `registry.fly.io/dotify-api@sha256:6c7c9cfefc1cd81d184c1ac1f76aec5628f5235699c478910ff48fa6ec381907` |
| Encoder | `registry.fly.io/dotify-encoder@sha256:a7d37122f3064012c03a7ea13b38977cc60dc785f6aaea5b559626e4853e8689` |
| Signaling | `registry.fly.io/dotify-signal@sha256:c18ae1a3b0733c248a271dcaca1e7d82bd36d59784163372c4e42e689a4c2e68` |

Each remote manifest's configuration digest matched the locally tested image.
All five running machines were read back against these manifest references and
reported Linux amd64, UID 1000 and Node 22.23.5. Registry identity verification is
not an independent image-signature verification or a full operating-system audit.

## What this changes for listeners and artists

The [listening-security fixes](../../listening-security-hardening.md) keep
revocation and expiry authoritative while a key request is in flight. A session
is checked again after access reads; a batch grant must still be valid before its
key is derived. This strengthens enforcement of existing artist choices without
adding per-track wallet prompts or changing free listening and anonymous Room
joining. It cannot retract keys already delivered to a client.

Malformed request and Room negotiation limits now run on the hosted services.
The [API validators](../../../reference/api-schema-compatibility.md) use Zod 4.6.7;
the [runtime](../../../reference/server-runtime.md) uses the reviewed Node 22 patch.
The integrated source also includes [coordinated proof reads](../../../adr/0058-coordinate-bulletin-proof-loads.md).
No reduction in live publication latency was measured during this delivery.

Compact readers and recovery commands are present in the integrated image.
Compact writing still requires a separately explicit admission; none was changed.
Recovery commands are not part of normal startup and were not executed here.
There was no draft migration, journal reset or recreation of rejected state.

## Checks and operational sequence

- **Before deployment:** five expected machines, no active or uncertain publication,
  and no Room or solo presence. Previous image/configuration fingerprints were
  retained privately. Inspection output used an allowlist; no raw logs, key
  values, audio or master files were exported.
- **Backup and isolated inspection:** custody was stopped and its volume snapshot
  confirmed complete. Its existing image ran only a waiting process, without the
  application or writer, for read-only metadata inspection. The original command
  was restored with the machine stopped.
- **Progressive delivery:** encoder, one public API at a time, then custody.
  Custody's new image was first inspected in the same isolated mode. Matching
  protected metadata, nonce/account history and archive fingerprints permitted
  restoration of its ordinary startup command and one writer start.
- **Room service:** signaling was updated only after another zero-Room and
  zero-presence check. It was empty again after the update.
- **Readback:** each machine passed two health checks after its update and another
  check at completion. API/custody health and readiness returned 200; signaling
  health returned 200; the encoder rejected unauthenticated access with 401.
  Images, startup commands and stable configuration fingerprints matched the plan.
  The final custody inspection retained the protected-state fingerprints and
  found no active or uncertain publication.

Only images and existing source-version labels changed. Temporary custody startup
commands were restored. Secrets, network settings, mounts and scaling were not
replaced with repository defaults. Private machine/volume identifiers and metadata
fingerprints remain in the local operator packet rather than this public record.

## Validation and limits

Before upload, **193 API tests and 79 signaling tests** passed against the exact
compiled images. A generated 60-second AAC exercise authenticated the manifest,
master and encrypted objects, rejected unauthorized/malformed requests, and kept
the encoder isolated. Startup and clean SIGTERM passed for all three image roles.
These were local Linux amd64 emulation and synthetic data, not hosted throughput
or fresh real-media publication measurements.

The maintenance checks demonstrate deployment identity, availability and coherent
retained metadata. They do not prove native audibility, sustained capacity, full
OS/FFmpeg security, real independent recovery or a faster publication journey.
Image rollback remains possible only with a compatible state/configuration check;
it may reintroduce the corrected races. A volume snapshot must never be restored
blindly over later receipts or nonce history.

Next acceptance: play one existing release and host/join one Room on refreshed
clients, without a new publication or purchase. Then resume the
[selected product sequence](../listening-and-publication-readiness.md), keeping
physical listening, publication latency and deferred recovery distinct.
