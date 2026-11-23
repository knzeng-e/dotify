# Native artist prerequisites — 23 November 2026

The authorized read-only check succeeds from clean source
`bd4e8950a46b27b2622685a0e4cfbbcf6b16982e`, branched from merged #508 / dev
`64efa75d`. At finalized native block **16,102,263**, the intended Product
account has a matching existing native mapping and no registered or pending
runtime. Its pending stage is zero. No signer, mapping registration, transaction,
runtime creation, service activation or new phone test occurred.

The [minimized record](artist-prerequisites-2026-11-23.json) binds the private
report's byte digest and the same account fingerprint as the
[accepted 0.1.90 observation](host-account-ios-0.1.90-2026-11-22.md).
It omits the raw public key, artist/native addresses and balance. The full
report remains in the private local operations directory. `recordedAt` is the
recording clock, not a claimed device or transaction timestamp.

## Corrections demonstrated by the real read

The first merged reader failed closed on `Storage(Revive.OriginalAccount)`:
the frontend's legacy PAPI 1.23 codec could not interpret the current native
runtime entry. A separately pinned PAPI 3.3.0 operator alias reads it while the
frontend keeps its own dependency. A block hold lasts through mapping decode
and is released on success, error or abort. Genesis is checked before querying
the selected account.

The next refusal exposed different native and Ethereum hashes at the same
height. Revive's documented native-hash lookup resolves the native hash to an
Ethereum block. That result must match the canonical Ethereum by-number result
in both height and Ethereum hash. Equal heights alone are insufficient. The
v2 report retains both hashes; all contract/CDM/code reads use that finalized
height. These are trusted-RPC observations, not a light-client proof. The
[reader procedure](../../../how-to/check-artist-onboarding-prerequisites.md)
owns reproducible usage, the SDK source reference and failure boundaries.

A sparse detached checkout of `bd4e8950` supplies a clean source observation;
installed locked dependencies are reused locally. The working checkout's
unrelated skill edits are not part of the source or report. All **47** local
prerequisite/adapter tests and targeted lint pass. The ordinary Web build also
passes, retaining its existing chunk/annotation warnings. CI is separate from
this local observation.

## Separate public core observation

At finalized EVM block **16,101,720**, the existing `inspectFreshSystem` helper
and exact CDM reads verify all ten deployed bytecodes, seven facets,
initializer/directory/factory bindings, native precision 10, and both CDM
version-4 addresses. The directory has zero finalized artists. Solidity 0.8.28
artifacts were freshly compiled with optimizer 200 / viaIR / Paris into a
temporary directory using a configuration with no accounts. All 32 compiler
source inputs match committed `64efa75d`; the checked-in source, not stale local
artifacts, binds the comparison. The helper masks only compiler-declared
immutable slots and checks their binding getters.

This is a different block and observation from the selected-artist check.
Its private local record and build-info digests are retained; it does not change
the selected reader report's `reviewedBytecodeVerified: false`, global pending
coverage, or checked-in publication attestation.

## Remaining gate

`absent` describes this artist only. Eight bootstrap approvals would be required
for creation plus seven installation/finalization calls; that count is not a
signing plan or authorization. Global native pending discovery and complete
publication attestation remain open before an identified signer-control and
onboarding context. Matched new key/profile, services/clients, beneficiary
settlement and physical media acceptance keep #317/#85 open. CASH stays disabled.
