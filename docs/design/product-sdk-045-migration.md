# Coordinated Product SDK 0.45 migration

This candidate upgrades the Product SDK family together, rather than shipping
intermediate 0.40 and 0.44 profiles. **It is not eligible for deployment yet:**
transactions require a named, accepted TrUAPI 0.31.x Host. The owner's phone
reports 0.26; the inspected Desktop 0.9.4 archive bundles 0.29. Existing deployed
clients keep their earlier SDK and accepted behavior until promotion.

The [earlier investigation](product-sdk-host-upgrade-decision-2026-11-17.md)
explains the original hold. The owner now selects a coordinated candidate and
correction of the observed breaks. [Dated validation](../backlog/implementation/evidence/product-sdk-045-migration-2026-11-17.md)
records what is implemented, tested and still unaccepted.

## One dependency family

| Package | Candidate |
| --- | --- |
| Product SDK | 0.45.0 |
| Host SDK | 0.34.0 |
| TrUAPI override | 0.31.0 |
| Transactions | 0.5.10 |
| Statement store | 0.7.10 |
| Descriptors | 0.14.0, already latest |

The umbrella brings its matching signer, contracts, chain-client and storage
packages. The ordinary Web dependency graph keeps its existing PAPI major;
the SDK owns its PAPI 3 graph. This is a Product family migration, not a general
update of React, build tools, services or deployed networks.

## Correct public metadata without changing signing semantics

Upstream 0.31 requires a trailing `truapiVersion` in `system.info`; 0.25/0.26
responses have only platform, name and app version. The install-time
[patch](../../web/scripts/patch-truapi-info.mjs) replaces exactly that method's
decoder with [a strict compatibility decoder](../../web/patches/truapi-0.31-host-info.mjs).
It accepts a canonical complete modern response, or a canonical complete legacy
success. Truncated fields, unexplained bytes and denials are not converted into
success. A legacy response supplies `truapiVersion: ''` internally, meaning
unknown; reports omit Runtime when unknown. It does not infer 0.26 from an app
label or make an account/payment available.

The patch checks both the exact package version and upstream client SHA-256,
verifies repeated application, and refuses unexpected dependency bytes. `npm ci`
and `npm install` apply it through `postinstall`. If lifecycle scripts are
intentionally disabled, explicitly run `node scripts/patch-truapi-info.mjs`
before testing/building. Remove the workaround only with an upstream fix and the
same legacy/modern/error regressions passing. The separate research laboratory
continues to test unmodified published codecs; its earlier failure remains valid.

A compiler-only upgrade would also miss `createTransaction` moving from V1 to
V2. The legacy fixtures reject the new discriminant even though their handshake
still says codec 3. This candidate **does not translate or retry a signing
request**. Before constructing a Product transaction signer, a bounded
`system.info` read must report 0.31.x. Older, absent, malformed, busy or timed-out
observations refuse before signer construction. A compatible version selects
the reviewed wire family; it grants no account, signing or spending permission.
The ordinary account/consent checks still run. This preflight is repeated for
each signer rather than cached across Host changes.

`createProductSignerManager` owns that boundary for CDM writes and native PAS
contributions. Older Hosts can still use the tested account/message-signing and
Bulletin-read wire shapes, but their transactions are deliberately unavailable
in this candidate. Rewriting V2 to V1 automatically would hide an unsupported
signing contract. Requiring an accepted 0.31 Host is the chosen alternative.

## Evidence and promotion

The [36 fixture checks](../../web/scripts/product-sdk-compat.test.mjs) bind exact
account, username, message-signing, permission and Bulletin subscription bytes
across 0.25/0.26/0.29/0.31. They also preserve cancellation/denial, prove the V2
mismatch and verify the installed info patch. Three old codecs are dev-only
aliases; production ships one current codec with the explicit info patch.
These are simulated responses, not cryptographic signing, acoustic playback or
actual Host capability evidence.

Before promotion, verify a named 0.31 Host, same-account signing, exact native
PAS transaction/receipt recovery, protected Bulletin listening, Room/lock/artwork
and the standalone Web path. Follow [deployment configuration](../operations/deployment-configuration.md#product-devnet-frontend).
No Host is installed, paired or upgraded by changing npm dependencies.

CASH's latest manager now declares caller-chosen IDs and partial status. The
[work-tip decision](product-cash-tip-decision-2026-11-13.md) still owns durable
intent recovery and artist-policy settlement. Current [official money guidance](https://developers.polkadot.com/apps/architecture/money/)
places CASH behind Host Coinage services and distinguishes it from PAS; it does
not establish the exact executable integer units or the named Host's supported
payment/restart surface. CASH remains disabled. No `Completed` callback grants
access, and #408 remains separate.
