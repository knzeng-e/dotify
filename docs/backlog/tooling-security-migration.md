# Test and lint toolchain security migration

GitHub: #433. Priority: P1. Track: Production spine. Phase: Next. Type: Work.
Separate from application fixes #431 and API schema migration #432.

Production-dependency audit is clean for Web after the compatible #431 patches.
Full development audit still covers Vitest/mocker/Tinypool and lint/estree/
minimatch branches with parent major-version constraints. These tools are not
shipped application services, but critical development advisories remain real
work. Current `vitest run` uses Node mode without configured public test API;
that narrows exposure and does not remove the advisories.

Migrate to a patched supported runner (the reviewed candidate is Vitest5.1.0),
then a compatible lint/parser/minimatch graph. Validate Node22, all mock/worker
semantics, full unit/lint/Web/Product builds and offline CLI guards. Do not
suppress assertions, disable tests or globally override all minimatch consumers
to a new major. Keep SDK and signer compatibility explicit. Re-run full audit
including dev dependencies and record any remaining bounds before closure.

Sources: [Tinypool](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3),
[mocker](https://github.com/advisories/GHSA-qxg6-89mg-rqv8),
[minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249).
No service operation, deployment or signing is authorized by this record.
