# Development toolchain security

This reference describes the #433 candidate used to build and test Dotify.
`web/package.json` and its lockfile define the exact dependency graph. These
settings do not change hosted services, wallet signing or music storage.

## Runtime and dependency boundaries

Use Node **22.12 or newer within major 22**, with npm 10+. Vitest 5 requires
Node 22.12 and Vite 6.4 or newer; the candidate keeps the existing Vite 6.4.6
lockfile version. The Web CI job uses the minimum Node 22.12.0; Product and
browser jobs use the maintained Node 22 line. Hosted Node selection must satisfy
the same minimum before a later build.

Vitest 5.1.0 replaces the vulnerable Vitest 3 mocker/worker graph. It keeps the
Node test environment, file isolation, discovery and existing assertions.
Constructor mocks use constructable functions, and signer helpers use their
actual call signature instead of inferring a zero-argument mock type.

The scoped override replaces minimatch only beneath
`@typescript-eslint/typescript-estree` with 11.0.8. That consumer calls
`minimatch(path, pattern, { dot: true })` for project-service file admission.
The integration test in `web/scripts/security-dependencies.test.mjs` creates a
real TypeScript project: a hidden allowlisted file retains type diagnostics,
and a nonmatching file is refused. Ordinary ESLint consumers keep their v3
matcher. Do not replace this with a global override or a parser downgrade.

## Verification and limits

Run `npm ci`, `npm run test:unit`, `npm run lint`, `npm run build`,
`npm run build:product-devnet:frozen` and `npm run test:product-deploy-environment`
from `web`. The latter includes the parser integration and existing offline
CLI/signing guards; it does not deploy anything. Run `npm audit` including dev
dependencies, and report its date and lockfile commit. An empty audit is evidence
about known advisories, not proof of complete application security.

See [the tracked scope](../backlog/tooling-security-migration.md),
[Vitest 5 migration](https://vitest.dev/guide/migration/),
[Vitest 4 migration](https://v4.vitest.dev/guide/migration.html),
[the worker advisory](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) and
[the matcher advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).
