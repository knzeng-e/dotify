# Read-only Host qualification client

Use this client for the first #85 device gate before #317 artist onboarding.
It isolates the installed SDK's public `system.info` reading from the listener
app, catalogue, wallet, chain adapters and hosted services. It does not depend
on the retired catalogue or the still-unprepared new publication API.

The [21 November native delivery](host-info-0.1.89-delivery-2026-11-21.md) publishes
Product `dotify-test01.dot`, app **0.1.89**, from merged source `5de0b31e`. Its
actual DotNS records and Bulletin bytes are independently verified. It replaces
the native development app entry with this reader; ordinary Web remains on its
previous delivery. Physical Host qualification is still pending. Do not infer
an installed version from a checked-in deployment configuration.

The [exact publication plan](host-info-0.1.89-publication-plan-2026-11-21.md) records
the finite approved scope, which is now consumed. Later publication must use
its own current scope and checks.

## Build and identify the candidate

From a clean, reviewed checkout:

```sh
cd web
npm ci
npm run test:qualification
npm run build:qualification
```

The build emits `dist-qualification/index.html`, hashed assets and
`qualification-build.json`. The latter records source SHA, clean state,
configuration digest, SDK pins and every served file's size/SHA-256. It excludes
itself from that file list to avoid a circular hash. The envelope is at most
100 files / 3 MiB, before any later CAR packaging or metadata. It is not a
Bulletin operation count or permission to spend storage quota.

The compiler uses a separate entry and environment prefix. It refuses dirty
source, a conflicting source override, enabled E2E flags, browser credentials,
unapproved rendered application modules, testing Host code and chain descriptor
payloads. Only the qualification UI/report and existing bounded Host-info reader
are admitted as application code. Ordinary app build/catalogue generation is
not part of this command. The new browser tests also assert no account, chain,
payment, permission or Dotify API requests.

## User flow and exported information

The page waits for **Read app information**. It makes one bounded reading per
document using the same patched SDK and sanitizing reader as About. It never
connects an account or constructs a signer. Pending requests cannot accumulate;
a timeout or late response cannot silently turn into success. After the result,
**Copy support report** exports only source/configuration identity, public SDK/
Host labels, requested time and this client's non-spending boundary. The visible
read-only report remains available when the clipboard is unavailable.

A reported `0.31.x` Runtime passes this **wire-version reading only**. The app's
build number, configured Runtime screenshot, unavailable/old/malformed reading
or synthetic Host result does not qualify a physical device. The product ID is
the intended later account scope, not proof of an approved account or origin.

## Publication boundary

An identified native delivery record must precede the phone request. Use the
[Product publication procedure](product-devnet-deployment.md) to review the exact
clean artifact, CAR/block graph, finite storage/renewal scope, account nonces,
DotNS owner and bounded writes. Carry at least the retention floor recorded in
the [0.1.89 delivery](host-info-0.1.89-delivery-2026-11-21.md), plus any later
obligations; preserve the stopped custody writer and all protected history. Do not invoke the standard full-app build or reuse
an earlier publication journal to publish this separate candidate.

The [reviewed iOS Open SPA implementation](https://github.com/paritytech/trinity-user-agents/blob/main/hosts/ios/polkadot-app/Modules/DebugSettings/DebugSettingsWireframe.swift)
resolves a DotNS Product. An ordinary HTTPS preview is not itself native Host
qualification. Do not ask the owner to open an unverified preview as if it were
an installed candidate. Record exact DotNS metadata, version, storage CID,
served bytes and source for the actual candidate before following
[the device procedure](../how-to/qualify-product-host-031.md).

The separate qualification executable must be identified as read-only. Publishing
it to the existing development Product would temporarily replace that Product's
app entry; this is not stable DApp promotion or the coordinated API/client switch.
Native/device results remain pending until the named artifact is actually tested.

## After the wire record

First retain the actual report. Then verify the selected Polkadot artist
account/public-key-to-H160 mapping and the new factory's onboarding prerequisites,
including a matching publication attestation and native-aware pending-runtime
proof. Only a separate, identified onboarding context can request creation plus
seven install/finalize approvals. This reader contains no such action. New
Bulletin key/profile setup, matching services/bootstrap and listening/native
value-flow acceptance remain under #317/#484; CASH stays disabled.
