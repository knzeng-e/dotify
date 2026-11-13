# Node 22 server runtime

This reference is for contributors building Dotify’s API, isolated encoder,
signaling and offline reader. It owns the candidate runtime policy;
[dated evidence](../backlog/implementation/evidence/node-runtime-security-2026-11-13.md)
records what was built or tested. It does not describe a live deployment.

## Candidate selection

Use **Node 22.23.5**, the [official November 11 security release](https://nodejs.org/en/blog/release/v22.23.5),
within the existing supported major. The three Dockerfiles select the official
`node:22.23.5-bookworm-slim` image by its immutable multiarchitecture index digest:

- [API build, runtime and explicit maintenance target](../../services/api/Dockerfile);
- [encoder build and isolated runtime](../../services/api/Dockerfile.encoder);
- [signaling runtime](../../web/Dockerfile.signal).

Keep these selectors aligned in one reviewed update. Bookworm is explicit so a
tag change cannot silently select a different Debian release. Registry platform
metadata must include Linux arm64 and amd64; a local arm64 run alone does not
prove amd64 execution. Node’s official image source verifies upstream release
checksums/signatures; our validation separately checks the registry identity and
the actual built image. Do not describe registry readback as an independent
image-signature verification or an operating-system vulnerability scan.

`web/.nvmrc` selects the preferred local patch. Fixed-version prototype and
research jobs use the same patch. Package engines and deliberately older
minimum-version tool tests express compatibility, not a recommendation to use an
old patch for a public service or recovered secrets. General `node-version: 22`
CI jobs follow the maintained major; bind observations to the version they used.

## Verify a runtime refresh

Retain source/image digests, architecture, Node/OpenSSL/npm versions and operating
system version. Exercise HTTP listening and disconnect, key derivation/signatures,
state/receipt compatibility, graceful shutdown and the existing generated
non-root storage/recovery and AAC encoding rehearsals. The encoder must remain
without API configuration, key services or application dependencies. Ordinary
API/signaling continue as UID 1000. Build steps retain package-installation
privileges; root runtime use is limited to the explicit maintenance target and
reviewed fixture provisioning.

An empty npm audit covers neither Node itself nor Debian/FFmpeg packages. Update
the selected runtime against Node’s supported security release line before each
reviewed delivery, and record remaining dependency/OS review separately. Do not
rewrite older test reports as if they used the new runtime.

## Build context privacy

Build from a clean reviewed worktree. Both context filters exclude `.data`,
local environment files, dependency/build output, Git metadata, local credential
directories and `.npmrc`. `.data` contains operator archives and reports; it is
not application source. A file excluded by Docker’s context filter is not sent
to its builder. [BuildKit](https://docs.docker.com/build/buildkit/) can also skip
unused files, but explicit exclusions keep that privacy boundary independent of
the builder and future COPY changes. The canary test forces whole-context use;
it does not measure a previous live transfer.

Run `node scripts/rehearse-container-context.mjs` from `services/api` to exercise
the actual filters with generated canaries and public source sentinels. It builds
only tiny local staged contexts and removes its own images/staging. It neither
reads a real credential nor inventories a contributor’s private directories.
Known filters do not make arbitrary untracked files safe: review the context
and keep private data outside source builds.

## Portable offline readers

Export a reader with its explicit local name so the saved archive retains a
loadable reference. Bind its checksum, platform and immutable configuration and
OCI-manifest identities in the delivery record. Docker image stores can expose
different identities for the same image: resolve the imported named reference,
accept only the artifact’s recorded immutable identities and use the observed
immutable ID for every subsequent container. A tag alone is not the check.

Rehearse a cold import before transfer: use a newly owned test image, export it,
confirm its absence after removing only that image, then load the extracted
packet and complete the isolated test. An image already present on the producer
can hide an export/lookup defect. Never reset Docker, remove unrelated images or
weaken reader ownership checks to make a packet work. The
[content-key procedure](../operations/bulletin-recovered-key-check.md) owns real
key/file isolation; generated fixture ownership adapters are not real importers.

## Delivery boundary

Changing these files builds a candidate. It does not update Fly, transfer keys,
activate compact publishing or alter retained histories. Include the independently
reviewed API-schema and toolchain fixes when validating a combined image. A live
rollout still needs the [deployment controls](../operations/deployment-configuration.md)
and a compatible image/UID/configuration/state plan. Never activate custody from
a guarded data-only reconstruction.
