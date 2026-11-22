# iPhone Host-info acceptance — 22 November 2026

**The first non-spending Host-info gate passes on the owner's iPhone.** The
owner supplied the [support report](host-info-ios-0.1.89-2026-11-22.json) in the
working conversation. Its unchanged request timestamp is
`2026-11-21T23:44:08.316Z` (22 November, 00:44:08.316 Europe/Paris).
No repeat device test is needed for this record.

The report identifies Product `dotify-test01.dot`, app `0.1.89`, clean source
`5de0b31e573e11b7d98e2d4717cbe6bce29ae6bf` and configuration digest
`f4cfbb6b0af3776d7e5be22efaf962236dedc2c559c871e9519ee2dffa3ba024`.
These fields and SDK pins (Product 0.45.0 / Host 0.34.0 / TrUAPI 0.31.0) match
the [independently verified native delivery](../../../operations/host-info-0.1.89-delivery-2026-11-21.md).

## Observed scope

The bounded `system.info` call reports `status: reported`, `platform: Ios`,
`name: Polkadot App`, `version: 0.10.0 (23)` and `runtimeVersion: 0.31.0`.
This is an actual source-bound report, beyond the earlier configuration
screenshots. It accepts this method and Runtime-version gate for this named
iPhone/client, not the entire SDK or other devices.

All four report boundaries are false: no account requested, no signing
requested, no chain queried and no application API contacted. These are client
report declarations consistent with the isolated reader's reviewed behavior;
they are not independent network or signing traces.

## Next gate and limits

Use a separately identified context to connect the owner's artist account in
the Polkadot application with ordinary account consent, then check the intended
Product/derivation index and public-key-to-H160 mapping. The current reader has
no account action. Follow the [qualification procedure](../../../how-to/qualify-product-host-031.md)
for the remaining gates.

Account mapping, message/transaction signing, fresh-factory onboarding, actual
beneficiary settlement and matched-generation audio/Rooms remain unverified.
Fresh-deployment attestation and native-aware pending-runtime discovery are
still prerequisites for artist creation. #85 and #317 remain open; CASH stays
disabled. This observation changes no deployed artifact and grants no further
publication or transaction authority.
