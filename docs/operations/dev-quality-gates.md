# Dev Quality Gates

Dotify uses the `Dev Quality Gates` workflow to make `dev` a tested integration
branch before each implementation sequence starts.

## Workflow behavior

The workflow runs on:

- every pull request targeting `dev`;
- every push to `dev`;
- manual `workflow_dispatch` runs.

It does not use repository secrets and should remain safe for fork pull
requests. Live Product host, real-wallet, device, deployment, and fund-moving
checks stay outside this workflow as explicit release evidence.

## Required checks

Branch protection for `dev` requires these check names:

- `W01 / Workflow syntax`
- `W01 / Repository hygiene`
- `W01 / Web checks`
- `W01 / Signaling tests`
- `W01 / API tests and typecheck`
- `W01 / EVM contracts and ABI drift`
- `W01 / Product DevNet build`
- `W01 / Playwright core flows`

Do not require the legacy path-filtered `main` / `master` workflows for `dev`
branch protection. A path-filtered workflow can be skipped on documentation-only
changes and leave a required check pending. The W01 workflow intentionally has
no path filters so documentation-only PRs still produce the same required check
set.

## Coverage

- Repository hygiene validates backlog metadata offline and whitespace.
- Workflow syntax runs pinned `actionlint` over all GitHub Actions workflow
  files. This validates Actions-specific keys and expressions, not only generic
  YAML syntax.
- Web checks run formatting, lint, unit tests, production-env smoke, and the
  ordinary Vite build.
- Signaling checks run the Socket.IO signaling test suite.
- API checks run typecheck and the Fastify service test suite.
- EVM checks run Solidity formatting, compile, tests, ABI generation, and a
  generated-binding drift guard that fails on tracked or untracked output
  changes under `web/src/generated/contracts`.
- Product DevNet checks regenerate the bootstrap catalog in strict mode from
  `web/fixtures/product-devnet-catalog.json`, build the Product package without
  relying on the live catalog API, and fail if the generated bootstrap changes
  unexpectedly.
- Playwright checks run deterministic browser flows against local Vite and
  local signaling services from `web/playwright.config.ts`.

## Browser font isolation

The core Playwright dev server opts into `DOTIFY_E2E_LOCAL_FONTS=true`.
Vite removes only the Google Fonts stylesheet and preconnect links from that
server's HTML; the app uses its existing fallback font stacks. Local media,
Socket.IO/WebRTC and every audio/capture assertion remain active. These are
behavior checks, not acceptance of the production typography.

Ordinary development and all builds retain the original font links, even if
that variable is set during a build. No hosted setting is required. Keep the
30-second test deadline and zero automatic retries: remote font availability
must not consume the time intended for a user flow.

## Codec prerequisites

The API codec, offline Bulletin-prototype and two browser jobs use **Ubuntu
24.04** rather than following `ubuntu-latest` image changes. Before installing
system packages, they call
[`use-ubuntu-mirror.sh`](../../scripts/ci/use-ubuntu-mirror.sh). This helper
refuses outside Linux GitHub Actions / the known Ubuntu 24.04 mirror-list
contract. It selects the Kernel Archives' HTTPS Ubuntu mirror instead of the
unresolvable Azure mirror. Suites, components, Ubuntu signing keys and repository
signature checks remain unchanged; no key or unsigned package is imported.
[Ubuntu's archive-verification model](https://documentation.ubuntu.com/security/software-integrity/archive-verification/)
explains the package trust boundary independently of the delivery mirror.
The setting exists only on the disposable CI runner, not a production machine.

The API and prototype jobs then call
[`scripts/ci/ensure-ffmpeg.sh`](../../scripts/ci/ensure-ffmpeg.sh). An existing
usable FFmpeg binary is retained; if absent, the helper installs the official
Ubuntu package with repository signature checks and without recommended extras.
It never substitutes a third-party binary or skips the codec suite.

Package operations use IPv4, two acquisition retries and 20-second HTTP/HTTPS
timeouts. The update command has a 90-second deadline, installation 180 seconds,
and each can be killed after a further 10 seconds. The Actions prerequisite
step is capped at five minutes; the API job is capped at 15 minutes. Browser
system-package/audio setup steps are capped at seven minutes. DNS or
mirror failure remains a failed prerequisite rather than hours of silent wait.
`ffmpeg -version`/`-L` record the selected build/license. Existing real AAC
encode/decode, nonce, recovery and browser-fixture tests remain required.

This changes CI runners only, not the production encoder image or a hosted
setting. Do not modify service configuration or weaken assertions to repair a
runner repository failure. A clean-runner retry after an external outage still
needs the actual test results before it can count as passing.

## Compact AAC acceptance

Contributors can reproduce the local codec/transport gate without a wallet,
storage account, production key or live Bulletin endpoint. It is part of
`W35 / Adaptive streaming in three engines`, after the existing streaming and
Room-output suites. Use Node 22, FFmpeg with AAC encoding, and the lock-matched
Web and API dependencies. From the repository root:

```sh
npm ci --prefix services/api
npm ci --prefix web
cd services/api
DOTIFY_TEST_FFMPEG="$(command -v ffmpeg)" node --import tsx src/scripts/streamingFixture.test.ts ../../web/.data/streaming-fixture.json ../../web/.data/compact-streaming-fixture.json
cd ../../web
npx playwright install chromium webkit firefox
npx tsc --noEmit -p tsconfig.compact.json
npx playwright test --config playwright.compact.config.ts
```

The first artifact retains the existing archive-free browser contract. The second
contains complete standard/compact graphs of that same public synthetic audio;
only its playback subset enters the Host browser fixture. Missing artifacts,
decoding failures, absent audio signal and unexpected external HTTP traffic
fail the gate. In CI, the API job generates both artifacts; only this specialized
browser gate installs API dependencies to run its loopback fixture. Ordinary
Web/Product builds keep their existing dependency boundary.

The test servers bind only `127.0.0.1`: Vite Web `5293`, media API `5294`, Vite
Host mode `5295`. Run this configuration serially, without another process on
these ports. Its SDK responses and retained-key resolver are injected public
synthetic data, not the real Host bridge or key-delivery service. All fixture
scripts end in `.test.ts` and are excluded from the production API build.
Do not publish the fixture server or copy these local settings into Fly/Netlify.

The matrix's four intentional exclusions concern native HTTP-congestion cases
and WebKit progressive capture energy. PCM decoding at all three qualities and
compatibility guest-signal checks remain active on every engine/transport.
The [coverage and remaining gates](../reference/bulletin-compact-delivery.md#automated-codec-acceptance)
distinguish cold transport reopening from publication recovery and physical
device acceptance. Failure traces and filtered synthetic codec reports are
retained with the streaming job diagnostics.

## Operations

Branch protection was enabled on 2026-09-20 after the backlog reconciliation PR
was opened. It applies to administrators, requires a pull request with every
conversation resolved, requires the eight checks above against an up-to-date
`dev`, and rejects force pushes and branch deletion. The repository currently
has one maintainer, so it requires no approving review; review comments and all
checks still have to resolve before merge.

Rollback is straightforward: remove the required checks from branch protection,
then revert the W01 workflow commit if the workflow itself is the blocker. Do
not disable branch protection as a way to hide baseline failures; record the
failing job and fix it in a scoped PR.
