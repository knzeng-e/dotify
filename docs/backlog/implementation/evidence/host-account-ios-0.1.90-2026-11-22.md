# iPhone account choice and native mapping — 22 November 2026

**The owner confirms this is the intended artist account.** The source-bound
0.1.90 report accepts explicit Product-account sharing and consistent public
addresses on the named iPhone. A separate operator read finds an existing
finalized Revive mapping to the same public key. No mapping registration,
message/transaction signature or artist-runtime creation was performed.

The [structured evidence](host-account-ios-0.1.90-2026-11-22.json) retains the
public software/context/result fields and a canonical report digest. The full
owner-provided report and raw account readback are retained in the private local
qualification directory; direct account identifiers/balance are omitted here.
Its SHA-256 uses UTF-8 compact JSON with sorted keys. The key fingerprint binds
the account across this record without publishing the raw report in the repo.

## Source-bound owner observation

The report matches the [independently delivered artifact](../../../operations/host-account-0.1.90-delivery-2026-11-22.md):
source `ecba4ea0465fba154de65a7db7232be62f854acb`, clean build, configuration
`77a32db5e6922eee4bcad23a618d91b2abf6cb5a78fc7df68c9d0bc8d2950705`,
Product `dotify-test01.dot`, app `0.1.90`, SDK/Host/TrUAPI `0.45.0/0.34.0/0.31.0`.
The actual Host labels are Ios, Polkadot App `0.10.0 (23)`, Runtime `0.31.0`.

The info request occurred at `2026-11-22T20:22:11.167Z` and the account attempt
at `2026-11-22T20:22:14.115Z` (21:22 in Europe/Paris). The owner also explicitly
confirmed the intended account in the conversation; `ownerConfirmed` is true.
Requested context is Product `dotify-test01.dot`, derivation index 0, SS58 prefix
42. SDK SS58 encoding/decoding and H160 derivation independently match the same
nonzero 32-byte public key.

This accepts account sharing/choice on this client and device, not other Hosts,
other derivation indices or a main-wallet address. The SDK echoes requested
Product/index context, not an independent Host context proof. The report's
boundary flags are client declarations consistent with the isolated reader,
not independent traces. Its `chainMappingVerified: false` stays unchanged:
the client did not query a chain.

## Separate finalized operator read

The read-only check used the expected Paseo Asset Hub genesis
`0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2`.
At finalized block **16,093,142** (hash and UTC observation in the structured
record), `Revive.OriginalAccount` for the derived H160 is present. Decoding its
returned native account reproduces the owner's exact public key. No padded
fallback or historical artist address was used. No chain write or signer was
involved. This establishes the existing mapping at that block, not who created
it or continuing wallet control. No new registration transaction is needed for
this observed mapping.

## Next acceptance boundary

The [qualification procedure](../../../how-to/qualify-product-host-031.md#account-and-listening-acceptance)
now moves to an identified signer-control context and the fresh factory's
native-aware attestation/pending-runtime prerequisites. Message/key-request
acceptance needs its matching API/release context; transaction control and
artist approvals are distinct. Do not construct a funded attempt from account
sharing or replace the selected artist with the infrastructure publisher.

#85 and #317 remain open. No new device repetition is needed for this record.
The [fresh-generation procedure](../../../how-to/prepare-fresh-testnet-generation.md)
owns later artist creation and matched services/key scope. Native beneficiary
settlement, listening/Rooms and disabled CASH retain their separate gates.
The completed publication authority remains consumed.
