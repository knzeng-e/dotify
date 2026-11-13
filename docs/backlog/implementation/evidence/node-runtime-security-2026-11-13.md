# Node runtime and build-context security — 2026-11-13

Source: `51cdb5fe89a87fe072c55626070449e825f4068e`, including the Node image
selection and generated context regression, integrated with dev `17e6be04`. The
branch starts from last fully tested dev `c6e6fea8`. This is a local candidate:
no service, key, budget, source admission or stored history is changed.

The [runtime reference](../../../reference/server-runtime.md) owns the policy and
packaging contract. [#449](../../server-node-runtime.md) owns acceptance scope.
The [separate second-Mac record](second-mac-synthetic-2026-11-13.md) reports the
owner’s generated Docker test; it used the older runtime and is not evidence
for this Node update or real-key recovery.

## Inputs verified

The official [Node 22.23.5 release](https://nodejs.org/en/blog/release/v22.23.5)
is a same-major security update. The official image index resolves to
`sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee`.
It includes Linux amd64 manifest
`sha256:47725aca53d3295ec2d3be8f62726599b3033cc262edc2c7e429909b3ac599fc`
and arm64 manifest
`sha256:1ee7b5f35129c6f4af835661a7a3cfbdd4748944c23b05567aa6ec00c6689e46`.
The registry references the [official Docker source](https://github.com/nodejs/docker-node/tree/1274f3ee37d4d0e59d308ea25b83d9e21e4db862/22/bookworm-slim).
Manifest availability alone does not prove application execution on that CPU.

The temporary macOS arm64 test runtime matches the release’s SHA-256
`e7131995759b61a0170b646010d2ad35a5d37b4cb0d471f3e8317eac6f742f3d`.
It is used through a private PATH prefix; the installed host Node is not replaced.
This checks the official HTTPS checksum, not a separate local PGP verification.

Local Linux arm64 application image IDs (not a delivered combined image):

| Role      | Image ID                                                                  |
| --------- | ------------------------------------------------------------------------- |
| API       | `sha256:3a04a8f6a4787e0a087e649bbe918ac2deae1ccdf0eb688c7e03b133a1265f8a` |
| Encoder   | `sha256:e6343c6b59a267cf53686e2350169ea94f964795fa3c5c1d1a3ab4e9784f2bf3` |
| Signaling | `sha256:0d880215e4ae7546e758ea49697ce6c9728a7926e49407a1d1b9ce696422f6d2` |

## Demonstrated context failure

With each original context filter, a generated-only Docker `COPY .` rehearsal
receives a private canary: Web includes `.data`; API includes an unexcluded local
credential directory. Selective application COPY rules do not prevent the
preceding context transmission. No real private tree is read or copied.

The corrected filters pass both staged contexts: nine private canaries per
context are absent, while four public source sentinels remain. The test uses the
actual filter files and is added to W30 CI. It removes its own staged directories
and labeled images. Docker build cache can retain public fixture layers; no
claim is made that all daemon cache is erased.

## Local runtime validation

All following application checks use Node **22.23.5** on macOS arm64 or the
new Linux arm64 images. The dependency lockfiles are unchanged.

- **530 API tests / 43 suites** pass, with no failures or skips, including key
  derivation/signatures, historical state, replay/access refusals, HTTP disconnect
  and offline recovery. API typecheck and compilation pass.
- **1,147 frontend tests / 149 files**, **131 signaling tests / 11 suites**,
  and **26 offline Product/CLI guard tests** pass. Web/frozen Product builds and
  lint pass; two existing App hook warnings and bundle warnings remain visible.
- API, encoder and signaling images build locally. Readback confirms Node
  **22.23.5**, OpenSSL **3.5.9**, Linux arm64 and UID **1000** for ordinary
  runtime execution; API reports Debian **12.15**.
- The real signaling image starts with an empty Room set on an isolated local
  loopback, answers health and exits **0** on SIGTERM. Only this test container
  is removed. No production Room is contacted.
- Generated W30 storage migration/backup/rollback passes with network disabled,
  preservation of original bytes and newer revocations, and expected root-owned
  startup/wrong-fingerprint refusals. The ordinary runtime stays non-root.
- The W32 60-second synthetic AAC encoding/publication rehearsal authenticates
  output, refuses unauthorized workers/malformed media and preserves encoder
  isolation. Recorded controller peak RSS is **143,008 KiB** and worker memory
  peak **59,699,200 bytes** under the configured local limits. Its **17,993 ms**
  elapsed value is not live publication or a controlled runtime speed comparison.

## Remaining gates

Exact PR-head CI, including amd64 Docker execution, remains pending at recording.
The API-schema (#432/#446) and toolchain (#433/#447) fixes are separate candidates;
this runtime patch does not remove their npm advisories or establish an empty
OS/package vulnerability scan. Test the eventual combined image before delivery.

No live inspection/export, service restart, secret transfer or chain operation
occurs here. A real reader must be separately frozen and accepted, with encrypted
transfer and independently recovered content keys. Physical Web/Host listening,
locked-screen behavior, current canonical history, service/image rollback, hosted
capacity and acceptable live latency remain separate public-pilot gates.
